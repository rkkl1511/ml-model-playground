"""Preprocessing: turn a raw DataFrame into numbers a model can learn from.

Order matters. We split into train/test FIRST, then fit imputers, encoders
and scalers on the training rows only. Fitting on everything would leak
information from the test set into training (data leakage).
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

from summary import column_kind

MAX_CLASSES = 20
MIN_ROWS = 10
# a text column with more distinct values than this explodes into many columns
HIGH_CARDINALITY = 30
PREVIEW_ROWS = 5
PREVIEW_COLS = 12


class PreprocessError(ValueError):
    """A problem the user can fix (bad target, too few rows, ...)."""


class PreprocessConfig(BaseModel):
    target: str
    drop_columns: list[str] = Field(default_factory=list)
    numeric_impute: Literal["mean", "median"] = "median"
    categorical_impute: Literal["most_frequent",
                                "missing_label"] = "most_frequent"
    scaling: Literal["standard", "minmax", "none"] = "standard"
    test_size: float = Field(0.2, ge=0.1, le=0.5)
    stratify: bool = True
    random_state: int = 42


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


def _label(value) -> str:
    """1.0 -> '1', so numeric class labels look clean."""
    if isinstance(value, (float, np.floating)) and float(value).is_integer():
        return str(int(value))
    return str(value)


def _names(items: list[str], limit: int = 4) -> str:
    shown = ", ".join(items[:limit])
    extra = len(items) - limit
    return shown + (f" and {extra} more" if extra > 0 else "")


def build_preprocessor(numeric_cols, categorical_cols, cfg: PreprocessConfig) -> ColumnTransformer:
    transformers = []

    if numeric_cols:
        steps = [("impute", SimpleImputer(
            strategy=cfg.numeric_impute, keep_empty_features=True))]
        if cfg.scaling == "standard":
            steps.append(("scale", StandardScaler()))
        elif cfg.scaling == "minmax":
            steps.append(("scale", MinMaxScaler()))
        transformers.append(("num", Pipeline(steps), numeric_cols))

    if categorical_cols:
        if cfg.categorical_impute == "most_frequent":
            imputer = SimpleImputer(
                strategy="most_frequent", keep_empty_features=True)
        else:
            imputer = SimpleImputer(
                strategy="constant", fill_value="missing", keep_empty_features=True)
        steps = [
            ("impute", imputer),
            # handle_unknown="ignore": a category seen only in the test rows becomes all zeros
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
        transformers.append(("cat", Pipeline(steps), categorical_cols))

    return ColumnTransformer(transformers, verbose_feature_names_out=False)


def _split(X, y, cfg: PreprocessConfig, warnings: list[dict]):
    if cfg.stratify:
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

    # 1. Target: rows without a label can't teach the model anything
    data = df[df[cfg.target].notna()].copy()
    rows_without_label = len(df) - len(data)
    if len(data) < MIN_ROWS:
        raise PreprocessError(
            f"Only {len(data)} rows have a target value. Need at least {MIN_ROWS}.")

    y_raw = data[cfg.target]
    n_classes = int(y_raw.nunique())
    if n_classes < 2:
        raise PreprocessError(
            "The target has only one value, so there is nothing to predict.")
    if n_classes > MAX_CLASSES:
        raise PreprocessError(
            f"The target has {n_classes} distinct values. Classification works with 2 to "
            f"{MAX_CLASSES} classes, so pick a label column."
        )

    # Models want numbers: "setosa", "versicolor", ... become 0, 1, ...
    y_values = y_raw if column_kind(y_raw) == "numeric" else y_raw.astype(str)
    encoder = LabelEncoder()
    y = encoder.fit_transform(y_values)
    class_names = [_label(c) for c in encoder.classes_]

    # 2. Features: everything except the target and the dropped columns
    dropped = [c for c in cfg.drop_columns if c in data.columns]
    features = [c for c in data.columns if c !=
                cfg.target and c not in dropped]

    empty = [c for c in features if data[c].isna().all()]
    if empty:
        features = [c for c in features if c not in empty]
        dropped += empty
        warnings.append({
            "level": "info",
            "title": "Empty columns removed",
            "text": f"{_names(empty)} had no values at all, so they were dropped automatically.",
        })
    if not features:
        raise PreprocessError(
            "No feature columns left. Keep at least one column that isn't the target.")

    X = data[features].copy()
    numeric_cols = [c for c in features if column_kind(X[c]) == "numeric"]
    categorical_cols = [c for c in features if c not in numeric_cols]

    if numeric_cols:
        X[numeric_cols] = X[numeric_cols].replace([np.inf, -np.inf], np.nan)
    for col in categorical_cols:
        # One-hot encoding can't sort a mix of numbers and text, so make everything text
        X[col] = X[col].astype("object").map(
            lambda v: v if pd.isna(v) else str(v))
        n_unique = int(X[col].nunique())
        if n_unique > HIGH_CARDINALITY:
            warnings.append({
                "level": "warn",
                "title": "Very many categories",
                "text": f"'{col}' has {n_unique} distinct values, so it becomes {n_unique} separate columns. Consider dropping it.",
            })

    missing_cells = int(X.isna().sum().sum())

    # 3. Split FIRST, then fit the preprocessing on the training rows only
    X_train, X_test, y_train, y_test, stratified = _split(X, y, cfg, warnings)

    pre = build_preprocessor(numeric_cols, categorical_cols, cfg)
    Xt_train = np.asarray(pre.fit_transform(X_train),
                          dtype=float)   # fit + transform
    Xt_test = np.asarray(pre.transform(
        X_test), dtype=float)         # transform only
    feature_names = [str(n) for n in pre.get_feature_names_out()]

    # 4. Plain-language explanation of what happened
    n_onehot = len(feature_names) - len(numeric_cols)
    steps = [
        {
            "key": "target",
            "title": "Choose the target",
            "detail": (
                f"Predicting '{cfg.target}' with {n_classes} classes ({_names(class_names, 6)}). "
                f"Labels become the numbers 0 to {n_classes - 1}."
                + (f" {rows_without_label} rows without a label were removed." if rows_without_label else "")
            ),
            "why": "A model can only learn from rows where the right answer is known.",
        }
    ]
    if dropped:
        steps.append({
            "key": "drop",
            "title": "Drop columns",
            "detail": f"Removed {_names(dropped, 6)}.",
            "why": "IDs and constant columns carry no real signal, and IDs let a model memorize rows.",
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

    # 5. Before/after preview of the same first rows
    raw_cols = features[:PREVIEW_COLS]
    before_rows = json.loads(X_train.head(PREVIEW_ROWS)[
                             raw_cols].to_json(orient="records"))
    after_rows = np.round(Xt_train[:PREVIEW_ROWS, :PREVIEW_COLS], 3).tolist()

    train_counts = np.bincount(y_train, minlength=n_classes)
    test_counts = np.bincount(y_test, minlength=n_classes)

    summary = {
        "target": cfg.target,
        "class_names": class_names,
        "n_classes": n_classes,
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "features_before": len(features),
        "features_after": len(feature_names),
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "dropped_columns": dropped,
        "stratified": stratified,
        "class_split": [
            {"label": class_names[i], "train": int(
                train_counts[i]), "test": int(test_counts[i])}
            for i in range(n_classes)
        ],
        "steps": steps,
        "warnings": warnings,
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
        raw_features=features,
        numeric_cols=numeric_cols,
        categorical_cols=categorical_cols,
    )
    return prepared, summary
