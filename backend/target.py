"""Suggest what to predict, and whether it is a classification or regression.

The old rule was "a label column has between 2 and 20 distinct values", which
meant a price column could never be the target and a 23-category column was
rejected. Real datasets do not care about our thresholds, so we look at what
the data actually is:

  * A number column with many distinct values is a regression target.
  * A column with a handful of distinct values is a classification target.
  * A column that is different on every row is an id, not a target.
"""

import numpy as np
import pandas as pd

from infer import infer_column

# Names that usually mean "this is the thing you are trying to predict".
TARGET_WORDS = (
    "price", "target", "label", "class", "output", "result", "y",
    "churn", "fraud", "default", "score", "rating", "sentiment",
)

# Below this many classes, "classification" is really just counting.
MIN_CLASSES = 2
# Above this many classes, a label column is more useful as a number.
# The preprocessor uses the same limit, so the app never suggests a target
# it is going to refuse a moment later.
MAX_CLASSES = 50


def _name_hint(name: str) -> bool:
    lowered = name.lower()
    return any(word in lowered for word in TARGET_WORDS)


def _looks_like_index(series) -> bool:
    """True for a column that is just 1, 2, 3, ... down the rows.

    A row number is not a target, and it is not a feature either.
    """
    values = pd.to_numeric(series, errors="coerce").dropna().to_numpy()
    if len(values) < 2:
        return False
    return bool(np.array_equal(values, np.arange(len(values))) or
                np.array_equal(values, np.arange(1, len(values) + 1)))


def suggest_targets(df, infos: dict | None = None, limit: int = 8) -> list[dict]:
    """Rank the columns that could sensibly be the target.

    Each suggestion says which task it implies, so the user can see why.
    """
    suggestions = []
    rows = len(df)

    for column in df.columns:
        info = (infos or {}).get(str(column)) or infer_column(df[column])
        distinct = info.unique
        missing_pct = 100 * info.missing / rows if rows else 0

        if distinct < MIN_CLASSES:
            continue
        # A text column that is different on every row is an id, not a label.
        # A numeric one is not: a price column is usually different on every
        # row too, and that makes it a perfect regression target.
        if info.kind == "categorical" and distinct == rows and rows > 20:
            continue
        if info.kind == "numeric" and distinct == rows and rows > 20 \
                and _looks_like_index(df[column]):
            continue
        if missing_pct > 60:
            continue
        # A text column with hundreds of values is a name, not a label.
        if info.kind == "categorical" and distinct > MAX_CLASSES:
            continue

        if info.kind == "numeric" and distinct > MAX_CLASSES:
            task = "regression"
            detail = f"{distinct} different numbers, so this looks like a quantity to predict."
        else:
            task = "classification"
            detail = f"{distinct} distinct values, so this looks like a set of labels."

        # A score we can rank by.
        score = 0.0
        if _name_hint(str(column)):
            score += 3.0
        if task == "regression":
            score += 1.0
        # A handful of classes is a cleaner target than fifty.
        if MIN_CLASSES <= distinct <= 12:
            score += 1.5
        # Missing data makes a target harder to use, not easier.
        score -= missing_pct / 20
        # A column that is almost constant cannot teach a model anything.
        if distinct <= 2:
            score -= 1.0

        suggestions.append({
            "name": str(column),
            "task": task,
            "distinct": distinct,
            "missing_pct": round(missing_pct, 1),
            "kind": info.kind,
            "unit": info.unit,
            "score": round(score, 2),
            "detail": detail,
        })

    suggestions.sort(key=lambda s: -s["score"])
    return suggestions[:limit]


def detect_task(df, column: str, max_classes: int = MAX_CLASSES) -> str:
    """Decide whether a column should be treated as a label or a number."""
    info = infer_column(df[column])
    if info.kind == "numeric" and info.unique > max_classes:
        return "regression"
    return "classification"
