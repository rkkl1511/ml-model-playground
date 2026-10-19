"""Column-by-column profiling of a DataFrame (what Step 4's charts show)."""

import numpy as np
import pandas as pd

from summary import column_kind

N_BINS = 12            # histogram bars
MAX_CATEGORIES = 12    # most-common values shown for text columns
# a column with 2-20 distinct values could be a label
MIN_CLASSES, MAX_CLASSES = 2, 20


def _num(value):
    """JSON cannot hold NaN or Infinity, so turn them into None (null)."""
    if value is None or not np.isfinite(value):
        return None
    return round(float(value), 6)


def _numeric_details(series: pd.Series) -> dict:
    values = series.dropna()
    values = values[np.isfinite(values)]
    if values.empty:
        return {}
    counts, edges = np.histogram(values, bins=N_BINS)
    return {
        "stats": {
            "mean": _num(values.mean()),
            "std": _num(values.std()),
            "min": _num(values.min()),
            "q25": _num(values.quantile(0.25)),
            "median": _num(values.median()),
            "q75": _num(values.quantile(0.75)),
            "max": _num(values.max()),
        },
        "histogram": [
            {"start": _num(edges[i]), "end": _num(
                edges[i + 1]), "count": int(counts[i])}
            for i in range(len(counts))
        ],
    }


def _balance(series: pd.Series):
    """How evenly are the values spread? Only meaningful for label-like columns."""
    counts = series.value_counts()  # ignores missing values, sorted high to low
    if not (MIN_CLASSES <= len(counts) <= MAX_CLASSES):
        return None
    total = int(counts.sum())
    return {
        "counts": [
            {"label": str(k), "count": int(
                v), "pct": round(float(100 * v / total), 1)}
            for k, v in counts.items()
        ],
        "majority_pct": round(float(100 * counts.iloc[0] / total), 1),
        "imbalance_ratio": round(float(counts.iloc[0] / counts.iloc[-1]), 1),
    }


def profile_column(df: pd.DataFrame, name: str) -> dict:
    series = df[name]
    kind = column_kind(series)
    n = len(series)
    missing = int(series.isna().sum())

    info = {
        "name": str(name),
        "kind": kind,
        "dtype": str(series.dtype),
        "missing": missing,
        "missing_pct": round(100 * missing / n, 1) if n else 0.0,
        "unique": int(series.nunique()),
        "balance": _balance(series),
    }
    if kind == "numeric":
        info.update(_numeric_details(series))
    else:
        top = series.value_counts().head(MAX_CATEGORIES)
        info["top_values"] = [
            {"value": str(k), "count": int(v)} for k, v in top.items()]
    return info


def _names(items: list[str], limit: int = 4) -> str:
    shown = ", ".join(items[:limit])
    extra = len(items) - limit
    return shown + (f" and {extra} more" if extra > 0 else "")


def build_warnings(df: pd.DataFrame, columns: list[dict], duplicate_rows: int) -> list[dict]:
    """Plain-language heads-ups that a data scientist would notice at a glance."""
    n = len(df)
    out = []

    heavy = [c["name"] for c in columns if c["missing_pct"] > 30]
    if heavy:
        out.append({
            "level": "warn",
            "title": "Lots of missing values",
            "text": f"{_names(heavy)}: more than 30% empty. Filling that many gaps means mostly guessing, so consider dropping these columns.",
        })

    constant = [c["name"] for c in columns if c["unique"] <= 1]
    if constant:
        out.append({
            "level": "warn",
            "title": "Columns that never change",
            "text": f"{_names(constant)}: a single value everywhere, so it can't help a model tell rows apart.",
        })

    id_like = [
        c["name"] for c in columns
        if n > 1 and c["unique"] == n
        and (c["kind"] == "categorical" or c["dtype"].startswith(("int", "uint")))
    ]
    if id_like:
        out.append({
            "level": "warn",
            "title": "Looks like an ID",
            "text": f"{_names(id_like)}: different on every row. IDs let a model memorize rows instead of learning patterns, so drop them before training.",
        })

    if duplicate_rows:
        out.append({
            "level": "warn",
            "title": "Duplicate rows",
            "text": f"{duplicate_rows} rows are exact copies. Duplicates can leak between training and test sets and inflate your score.",
        })

    if n < 100:
        out.append({
            "level": "info",
            "title": "Small dataset",
            "text": f"Only {n} rows. Scores can swing a lot depending on which rows land in the test set. Cross-validation helps (Step 8).",
        })

    text_cols = [c["name"] for c in columns if c["kind"] == "categorical"]
    if text_cols:
        out.append({
            "level": "info",
            "title": "Text columns need encoding",
            "text": f"{_names(text_cols)}: models only understand numbers, so we'll convert these in Step 5.",
        })

    return out


def build_profile(df: pd.DataFrame) -> dict:
    duplicate_rows = int(df.duplicated().sum())
    missing_cells = int(df.isna().sum().sum())
    columns = [profile_column(df, c) for c in df.columns]

    return {
        "rows": int(len(df)),
        "n_columns": int(df.shape[1]),
        "missing_cells": missing_cells,
        "missing_pct": round(100 * missing_cells / df.size, 1) if df.size else 0.0,
        "complete_rows": int(df.notna().all(axis=1).sum()),
        "duplicate_rows": duplicate_rows,
        "columns": columns,
        "warnings": build_warnings(df, columns, duplicate_rows),
    }
