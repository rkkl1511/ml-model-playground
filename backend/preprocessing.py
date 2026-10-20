"""Preprocessing: turn a raw DataFrame into numbers a model can learn from.

Order matters. We split into train/test FIRST, then fit imputers, encoders,
groupers and scalers on the training rows only. Fitting on everything would
leak information from the test set into training (data leakage).

Before the split we do the cleaning that needs no learning: reading numbers
out of "963 hp", turning "1.6 L" into 1600 cc, folding "TOYOTA" and "Toyota"
into one company. None of that looks at the test rows' statistics, so it
cannot leak.

The result is not just a matrix. It also explains itself: every decision we
made is in the report, because a tool that silently renames your columns is
a tool you cannot trust.
"""

import json
from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, MinMaxScaler, OneHotEncoder, StandardScaler

from infer import clean_frame, infer_column
from leakage import detect_leakage
from parsing import parse_column
from target import MAX_CLASSES, detect_task
from textnorm import canonical_key, clean_text
from transformers import RareCategoryGrouper

MIN_ROWS = 10
# a text column with more distinct values than this explodes into many columns
HIGH_CARDINALITY = 30
PREVIEW_ROWS = 5
PREVIEW_COLS = 12


class PreprocessError(ValueError):
    """A problem the user can fix (bad target, too few rows, ...)."""


class PreprocessConfig(BaseModel):
    target: str
    task: Literal["auto", "classification", "regression"] = "auto"
    drop_columns: list[str] = Field(default_factory=list)
    numeric_impute: Literal["mean", "median"] = "median"
    categorical_impute: Literal["most_frequent",
                                "missing_label"] = "most_frequent"
    scaling: Literal["standard", "minmax", "none"] = "standard"
    test_size: float = Field(0.2, ge=0.1, le=0.5)
    stratify: bool = True
    random_state: int = 42
    # What to do with a column that has hundreds of one-off values.
    high_cardinality: Literal["group_rare", "drop", "keep"] = "group_rare"
    # Above this many distinct values a text column counts as high cardinality.
    max_categories: int = Field(50, ge=5, le=1000)
    # Inside a grouped column, values seen fewer than this often become "other".
    rare_threshold: int = Field(20, ge=2, le=1000)
    # Read numbers out of text ("963 hp" -> 963). Turning this off makes the
    # old behaviour: everything is exactly what pandas says it is.
    parse_numbers: bool = True
    # Drop columns that give the answer away.
    drop_leaky: bool = True


@dataclass
class Prepared:
    """Everything later steps (training, prediction) need, kept together."""

    X_train: np.ndarray
    X_test: np.ndarray
    y_train: np.ndarray
    y_test: np.ndarray
    feature_names: list[str]      # names AFTER encoding, e.g. "city_Delhi"
    # class_names[i] is the label for the number i
    class_names: list[str]
    preprocessor: ColumnTransformer  # fitted: reuse it to transform new rows
    config: PreprocessConfig
    raw_features: list[str]       # original columns fed into the preprocessor
    numeric_cols: list[str]
    categorical_cols: list[str]
    task: str = "classification"
    # For regression: the units of the target, for a readable report.
    target_unit: str | None = None
    # Columns that were removed because they gave the target away. The
    # trainer mentions them, because a low score is often their doing.
    dropped_leaks: list[str] = None


def _label(value) -> str:
    """1.0 -> '1', so numeric class labels look clean."""
    if isinstance(value, (float, np.floating)) and float(value).is_integer():
        return str(int(value))
    return str(value)


def _names(items: list[str], limit: int = 4) -> str:
    shown = ", ".join(items[:limit])
    extra = len(items) - limit
    return shown + (f" and {extra} more" if extra > 0 else "")


def _categorical_pipeline(cfg: PreprocessConfig, group_rare: bool) -> Pipeline:
    """One-hot encoding, optionally folding rare values into a bucket."""
    if cfg.categorical_impute == "most_frequent":
        imputer = SimpleImputer(
            strategy="most_frequent", keep_empty_features=True)
    else:
        imputer = SimpleImputer(
            strategy="constant", fill_value="missing", keep_empty_features=True)
    steps = [("impute", imputer)]
    if group_rare:
        # Fitted on the training rows only, so it cannot peek at the test set.
        steps.append(("group", RareCategoryGrouper(threshold=cfg.rare_threshold)))
    steps.append(
        # handle_unknown="ignore": a category seen only in the test rows becomes all zeros
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    )
    return Pipeline(steps)


def build_preprocessor(numeric_cols, categorical_cols, cfg: PreprocessConfig,
                       group_cols=None) -> ColumnTransformer:
    """Build the pipeline that turns cleaned columns into a matrix.

    "group_cols" is the list of categorical columns that are allowed to have
    their rare values rolled into one bucket. Only genuinely high-cardinality
    columns belong in it: a column with four useful categories must not have
    them merged away just because the dataset is small.
    """
    transformers = []

    if numeric_cols:
        steps = [("impute", SimpleImputer(
            strategy=cfg.numeric_impute, keep_empty_features=True))]
        if cfg.scaling == "standard":
            steps.append(("scale", StandardScaler()))
        elif cfg.scaling == "minmax":
            steps.append(("scale", MinMaxScaler()))
        transformers.append(("num", Pipeline(steps), numeric_cols))

    group_cols = [c for c in (group_cols or []) if c in categorical_cols]
    plain_cols = [c for c in categorical_cols if c not in group_cols]

    if plain_cols:
        transformers.append(
            ("cat", _categorical_pipeline(cfg, group_rare=False), plain_cols))
    if group_cols:
        transformers.append(
            ("cat_rare", _categorical_pipeline(cfg, group_rare=True), group_cols))

    return ColumnTransformer(transformers, verbose_feature_names_out=False)


def _split(X, y, cfg: PreprocessConfig, warnings: list[dict], stratify: bool):
    if stratify:
        try:
            parts = train_test_split(
                X, y, test_size=cfg.test_size, random_state=cfg.random_state, stratify=y
            )
            return (*parts, True)
        except ValueError:
            warnings.append({
                "level": "warn",
                "title": "Couldn't stratify",
                "text": "Some class has too few rows to appear in both train and test, so we used a plain random split instead.",
            })
    parts = train_test_split(
        X, y, test_size=cfg.test_size, random_state=cfg.random_state)
    return (*parts, False)


def prepare(df: pd.DataFrame, cfg: PreprocessConfig) -> tuple[Prepared, dict]:
    warnings: list[dict] = []

    if cfg.target not in df.columns:
        raise PreprocessError(f"Target column '{cfg.target}' was not found.")
    if cfg.target in cfg.drop_columns:
        raise PreprocessError("The target column can't also be dropped.")

    # 1. What kind of task is this? The user can override it.
    task = cfg.task
    if task == "auto":
        task = detect_task(df, cfg.target)
    if task == "regression" and cfg.stratify:
        # You cannot keep class ratios in a task that has no classes.
        warnings.append({
            "level": "info",
            "title": "Stratifying turned off",
            "text": "A regression target has no classes to keep in proportion, "
                    "so the rows were split at random.",
        })

    # 2. Target: rows without a label can't teach the model anything
    data = df[df[cfg.target].notna()].copy()
    rows_without_label = len(df) - len(data)

    target_values, target_meta = prepare_target_values(data, cfg, task)
    data[cfg.target] = target_values
    data = data[data[cfg.target].notna()].copy()
    rows_without_label += int(target_values.isna().sum())
    warnings.extend(target_meta["notes"])

    if len(data) < MIN_ROWS:
        raise PreprocessError(
            f"Only {len(data)} rows have a target value. Need at least {MIN_ROWS}.")

    # 3. Clean the feature columns: read numbers, fix units, fold spellings.
    cleaned, infos, clean_notes = clean_frame(
        data, cfg.target, cfg.drop_columns,
        high_cardinality=cfg.high_cardinality,
        rare_threshold=cfg.rare_threshold,
        max_categories=cfg.max_categories,
    )
    warnings.extend(clean_notes)

    if cleaned.shape[1] == 0:
        raise PreprocessError(
            "No feature columns left. Keep at least one column that isn't the target.")

    # 4. Leakage: a column that gives the answer away.
    # We check the cleaned columns, so "Diesel" in a feature and "Diesel" in
    # the target are recognised as the same word even if one was written
    # "diesel".
    leak_frame = cleaned.copy()
    leak_frame[cfg.target] = target_values.reindex(cleaned.index)
    leakage = detect_leakage(leak_frame, cfg.target, task)
    if leakage and cfg.drop_leaky:
        leaked = [finding["column"] for finding in leakage]
        cleaned = cleaned.drop(columns=[c for c in leaked if c in cleaned.columns])
        # Say what was actually lost. A column that predicted the target
        # perfectly may have been the only real signal in the file, and
        # without that warning the model just looks broken.
        strongest = max(leakage, key=lambda f: f.get("purity", 0))
        lost = ""
        if strongest.get("purity", 0) >= 0.9:
            lost = (f" '{strongest['column']} alone got the target right "
                    f"{strongest['purity']:.0%} of the time, so it may have been the "
                    f"only real signal in your file. Without it the model has much "
                    f"less to work with, and a poor score is expected. Turn off "
                    f"'Drop columns that give the answer away' if you want to see "
                    f"what it does with them.")
        warnings.append({
            "level": "warn",
            "title": "Columns dropped because they give the answer away",
            "text": f"{_names(leaked, 4)} {'contain' if len(leaked) > 1 else 'contains'} "
                    f"the target's own labels. A model would score well without "
                    f"learning anything, so we left them out."
                    + lost,
        })
    elif leakage:
        warnings.append({
            "level": "warn",
            "title": "This column leaks the answer",
            "text": f"{_names([f['column'] for f in leakage], 4)} could give the target away. "
                    f"We kept it because you asked us to, but any score will be flattering.",
        })

    if cleaned.shape[1] == 0:
        raise PreprocessError(
            "Every feature column leaked the target, so there is nothing left to learn from.")

    # 5. Split into numbers and labels.
    numeric_cols = []
    categorical_cols = []
    for column in cleaned.columns:
        series = cleaned[column]
        if pd.api.types.is_numeric_dtype(series):
            numeric_cols.append(column)
        else:
            categorical_cols.append(column)

    if not numeric_cols and not categorical_cols:
        raise PreprocessError("No usable feature columns left after cleaning.")

    # Only a genuinely high-cardinality column gets its rare values rolled
    # into a bucket. A column with a dozen useful categories is left alone,
    # however small the dataset is.
    group_cols = []
    if cfg.high_cardinality == "group_rare":
        for info in infos:
            if (info.kind == "categorical" and info.name in categorical_cols
                    and info.unique > cfg.max_categories):
                group_cols.append(info.name)

    if task == "classification":
        y_raw = data[cfg.target]
        n_classes = int(y_raw.nunique())
        if n_classes < 2:
            raise PreprocessError(
                "The target has only one value, so there is nothing to predict.")
        if n_classes > MAX_CLASSES:
            raise PreprocessError(
                f"The target has {n_classes} distinct values. Classification works with 2 to "
                f"{MAX_CLASSES} classes, so pick a label column with fewer values, or "
                f"switch the task to regression if it is really a number."
            )
        encoder = LabelEncoder()
        y = encoder.fit_transform(y_raw.astype(str))
        class_names = [_label(c) for c in encoder.classes_]
    else:
        y = pd.to_numeric(data[cfg.target], errors="coerce").to_numpy(dtype="float64")
        y = y[~np.isnan(y)]
        class_names = []
        n_classes = 0

    # 6. Split FIRST, then fit the preprocessing on the training rows only.
    X_train, X_test, y_train, y_test, stratified = _split(
        cleaned, y, cfg, warnings, stratify=cfg.stratify and task == "classification")

    pre = build_preprocessor(numeric_cols, categorical_cols, cfg, group_cols)
    Xt_train = np.asarray(pre.fit_transform(X_train),
                          dtype=float)   # fit + transform
    Xt_test = np.asarray(pre.transform(
        X_test), dtype=float)         # transform only
    feature_names = [str(n) for n in pre.get_feature_names_out()]

    # 7. Plain-language explanation of what happened
    steps = [{
        "key": "target",
        "title": "Choose the target",
        "detail": _target_detail(cfg, task, n_classes, class_names,
                                  rows_without_label),
        "why": "A model can only learn from rows where the right answer is known.",
    }]

    parsed = [i for i in infos if i.kind == "numeric" and i.parse_ratio < 1.0]
    if parsed and cfg.parse_numbers:
        steps.append({
            "key": "parse",
            "title": "Read numbers out of text",
            "detail": f"{_names([i.name for i in parsed], 4)} held numbers written "
                      f"with units or symbols (\"963 hp\", \"$1,100,000\"). We pulled "
                      f"the numbers out so they are numbers, not labels.",
            "why": "A column of measurements should be one number column. As text "
                   "it becomes thousands of one-off categories and the model learns nothing.",
        })

    converted = [i for i in infos if i.kind == "numeric" and len(i.units) > 1
                 and not i.mixed]
    if converted:
        steps.append({
            "key": "units",
            "title": "Put units on one scale",
            "detail": f"{_names([i.name for i in converted], 4)} mixed units "
                      f"(for example cc and litres). Everything was converted to one "
                      f"unit so the numbers can be compared.",
            "why": "1,600 cc and 1.6 L are the same amount. If the model sees them "
                   "as different categories, it has to learn the conversion from the data.",
        })

    split_notes = [i for i in infos if i.mixed]
    if split_notes:
        steps.append({
            "key": "split_units",
            "title": "Split columns that mix units",
            "detail": f"{_names([i.name for i in split_notes], 4)} held different kinds "
                      f"of measurement in the same cell. They were split into one "
                      f"column per measurement.",
            "why": "cc and kWh measure different things. Putting them in one column "
                   "would mean averaging an engine size with a battery size.",
        })

    merged = [i for i in infos if i.variants]
    if merged:
        steps.append({
            "key": "spelling",
            "title": "Merge spellings of the same thing",
            "detail": f"{_names([i.name for i in merged], 4)} had values that differ "
                      f"only by case, like TOYOTA and Toyota. They are now one value.",
            "why": "Two spellings of one manufacturer are one manufacturer. Splitting "
                   "them teaches the model that half the rows are a different brand.",
        })

    if cfg.high_cardinality == "group_rare":
        grouped = [i for i in infos if i.kind == "categorical" and i.unique > cfg.max_categories]
        if grouped:
            steps.append({
                "key": "rare",
                "title": "Roll rare values into one bucket",
                "detail": f"{_names([i.name for i in grouped], 4)} had hundreds of "
                          f"one-off values. Values seen fewer than {cfg.rare_threshold} "
                          f"times in training now count as 'other'.",
                "why": "One-hot encoding hundreds of one-off names gives hundreds of "
                       "almost-empty columns. The popular ones carry the signal; the "
                       "rest do not.",
            })
    steps.append({
        "key": "split",
        "title": "Split into train and test",
        "detail": (
            f"{len(X_train)} rows to learn from, {len(X_test)} held back for testing "
            f"({round(cfg.test_size * 100)}%). "
            + ("Stratified, so every class keeps its share." if stratified else "A random split.")
            + f" Seed {cfg.random_state} makes it repeatable."
        ),
        "why": "Testing on rows the model has never seen is the only honest way to score it. "
               "We split before anything else so nothing leaks from the test rows.",
    })

    missing_cells = int(cleaned.isna().sum().sum())
    if missing_cells:
        text_fill = "the most common value" if cfg.categorical_impute == "most_frequent" else "the label 'missing'"
        steps.append({
            "key": "impute",
            "title": "Fill missing values",
            "detail": (
                f"{missing_cells} empty cells. Numbers get their column's {cfg.numeric_impute}; "
                f"text gets {text_fill}. Fill values are learned from the training rows only."
            ),
            "why": "Most algorithms crash on blanks, and a sensible fill keeps the row usable.",
        })

    if categorical_cols:
        n_onehot = len(feature_names) - len(numeric_cols)
        steps.append({
            "key": "encode",
            "title": "One-hot encode text",
            "detail": f"{len(categorical_cols)} text column(s) became {n_onehot} columns of 0s and 1s.",
            "why": "Models do maths. Turning 'Delhi' into 1,2,3 would claim Pune is 'bigger' than Delhi, so each category gets its own yes/no column.",
        })

    if cfg.scaling != "none" and numeric_cols:
        if cfg.scaling == "standard":
            detail = "Each numeric column is shifted to mean 0 and spread 1, using the training rows' mean and spread."
        else:
            detail = "Each numeric column is squeezed into 0 to 1, using the training rows' min and max."
        steps.append({
            "key": "scale",
            "title": "Scale numbers",
            "detail": detail,
            "why": "KNN and logistic regression are sensitive to size: a column in thousands would drown out one in decimals. Tree models don't care.",
        })

    # 8. Before/after preview of the same first rows
    raw_cols = [c for c in cleaned.columns][:PREVIEW_COLS]
    before_rows = json.loads(cleaned.head(PREVIEW_ROWS)[
                             raw_cols].to_json(orient="records"))
    after_rows = np.round(Xt_train[:PREVIEW_ROWS, :PREVIEW_COLS], 3).tolist()

    if task == "classification":
        train_counts = np.bincount(y_train, minlength=n_classes)
        test_counts = np.bincount(y_test, minlength=n_classes)
        class_split = [
            {"label": class_names[i], "train": int(train_counts[i]),
             "test": int(test_counts[i])}
            for i in range(n_classes)
        ]
    else:
        class_split = []

    summary = {
        "target": cfg.target,
        "task": task,
        "class_names": class_names,
        "n_classes": n_classes,
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "features_before": int(len(cleaned.columns)),
        "features_after": len(feature_names),
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "dropped_columns": [c for c in cfg.drop_columns if c in df.columns],
        "leaked_columns": [f["column"] for f in leakage],
        "stratified": stratified,
        "class_split": class_split,
        "steps": steps,
        "warnings": warnings,
        "columns": [i.to_dict() for i in infos],
        "leakage": leakage,
        "before": {"columns": raw_cols, "rows": before_rows},
        "after": {
            "columns": feature_names[:PREVIEW_COLS],
            "rows": after_rows,
            "hidden_columns": max(0, len(feature_names) - PREVIEW_COLS),
        },
    }

    prepared = Prepared(
        X_train=Xt_train,
        X_test=Xt_test,
        y_train=y_train,
        y_test=y_test,
        feature_names=feature_names,
        class_names=class_names,
        preprocessor=pre,
        config=cfg,
        raw_features=list(cleaned.columns),
        numeric_cols=numeric_cols,
        categorical_cols=categorical_cols,
        task=task,
        target_unit=target_meta.get("unit"),
        dropped_leaks=[f["column"] for f in leakage] if cfg.drop_leaky else [],
    )
    return prepared, summary


def prepare_target_values(data: pd.DataFrame, cfg: PreprocessConfig,
                          task: str) -> tuple[pd.Series, dict]:
    """Clean the target column and report what we found."""
    notes: list[dict] = []
    series = data[cfg.target]
    info = infer_column(series)

    if task == "regression":
        unit = info.unit
        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            values = pd.to_numeric(series, errors="coerce")
        elif cfg.parse_numbers:
            # The column is text, but it holds numbers: "$1,100,000".
            cells, _ = parse_column(series.tolist())
            values = pd.Series(
                [c.value if c.numeric else np.nan for c in cells],
                index=series.index, dtype="float64")
            notes.append({
                "level": "info",
                "title": "Numbers read out of the target",
                "text": f"'{cfg.target}' was written as text, with symbols and units. "
                        f"We pulled the numbers out of it so it can be used as a quantity.",
            })
        else:
            values = pd.to_numeric(series, errors="coerce")
        return values, {"notes": notes, "unit": unit}

    # Classification: fold spelling variants together so "TOYOTA" and
    # "Toyota" are one class, then keep the readable spelling for display.
    display: dict[str, str] = {}
    for raw in series:
        text = clean_text(raw)
        if not text:
            continue
        key = canonical_key(text)
        current = display.get(key)
        if current is None or (text.isupper() and not current.isupper()):
            display[key] = text

    values = pd.Series(
        [display.get(canonical_key(clean_text(raw)), clean_text(raw)) if clean_text(raw) else None
         for raw in series],
        index=series.index, dtype="object")
    if info.variants:
        notes.append({
            "level": "info",
            "title": "Spellings of the target merged",
            "text": f"'{cfg.target}' had {len(info.variants)} value(s) that differ only "
                    f"by case. They are now one label each.",
        })
    return values, {"notes": notes, "unit": None}


def _target_detail(cfg: PreprocessConfig, task: str, n_classes: int,
                   class_names: list[str], rows_without_label: int) -> str:
    if task == "regression":
        return (f"Predicting the number in '{cfg.target}'. "
                + (f"{rows_without_label} rows without a value were removed."
                   if rows_without_label else ""))
    return (
        f"Predicting '{cfg.target}' with {n_classes} classes ({_names(class_names, 6)}). "
        f"Labels become the numbers 0 to {n_classes - 1}."
        + (f" {rows_without_label} rows without a label were removed." if rows_without_label else "")
    )
