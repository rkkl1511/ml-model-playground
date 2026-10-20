"""Find the columns that give the answer away.

"Leakage" is when a feature column contains the target in disguise. A car
file whose "Engines" column literally says "Diesel" or "Petrol", while the
target column is "Fuel Types", is the classic example: the model does not
learn to predict fuel type, it learns to read it off a second column. The
score looks great and means nothing.

The distinction that matters is between a leak and a good feature:

  * A good feature predicts the target well. "Colour" being red/blue/green
    tells you the answer is yes or no. That is signal, and throwing it away
    would leave the model with nothing to learn from.
  * A leak IS the target, spelled differently. It uses the target's own
    words, or has exactly the target's shape and the same mapping.

So the question we ask is "could this column be the target in disguise?",
not "does this column predict the target well?".
"""

import numpy as np
import pandas as pd

from textnorm import canonical_key

# A feature that reproduces the target this well is not predicting it.
LEAK_PURITY = 0.95

# A copy with different words still has the target's shape: the same number
# of groups, and each group maps onto exactly one answer.
COPY_PURITY = 0.90

# A numeric feature this correlated with a numeric target is the same number
# wearing a different name.
LEAK_CORRELATION = 0.98


def _names(items, limit: int = 4) -> str:
    items = sorted(str(item) for item in items)
    shown = ", ".join(items[:limit])
    extra = len(items) - limit
    return shown + (f" and {extra} more" if extra > 0 else "")


def _baseline(target: pd.Series) -> float:
    """How often the most common target value is right.

    This is the floor. A feature that cannot beat it has learned nothing,
    no matter what its own accuracy looks like.
    """
    counts = target.value_counts()
    if counts.empty:
        return 0.0
    return float(counts.iloc[0] / counts.sum())


def _purity(feature: pd.Series, target: pd.Series) -> float:
    """How often the most common target value inside each group is right.

    If "Diesel" always means "Diesel" and "Petrol" always means "Petrol",
    this is 1.0: the feature hands over the answer.
    """
    frame = pd.DataFrame({"f": feature, "t": target})
    # The most common target value for each feature value.
    best = frame.groupby("f")["t"].agg(lambda s: s.value_counts().idxmax())
    predicted = frame["f"].map(best)
    return float((predicted == frame["t"]).mean())


def _names_a_target_label(value, target_words) -> bool:
    """True when this value names one of the target's labels.

    "Diesel Engine" still names "Diesel". We compare whole words, not
    letters, so "North" is not read as the target label "No".
    """
    text = canonical_key(value)
    if not text:
        return False
    if text in target_words:
        return True
    words = set(text.replace("-", " ").replace("/", " ").split())
    return bool(words & target_words)


def detect_leakage(df: pd.DataFrame, target: str, task: str) -> list[dict]:
    """Return the feature columns that leak the target."""
    if target not in df.columns:
        return []

    findings: list[dict] = []
    target_text = df[target].astype(str)
    baseline = _baseline(target_text)
    target_words = {canonical_key(v) for v in target_text.unique()}
    target_classes = target_text.nunique()

    for column in df.columns:
        if column == target:
            continue

        feature = df[column]
        if feature.nunique(dropna=True) < 2:
            continue

        if task == "regression":
            if pd.api.types.is_numeric_dtype(feature) and \
                    pd.api.types.is_numeric_dtype(df[target]):
                numbers = pd.to_numeric(feature, errors="coerce")
                valid = numbers.notna() & df[target].notna()
                if valid.sum() > 10:
                    correlation = numbers[valid].corr(df[target][valid])
                    if np.isfinite(correlation) and abs(correlation) >= LEAK_CORRELATION:
                        findings.append({
                            "column": column,
                            "level": "warn",
                            "severity": "direct",
                            "purity": 1.0,
                            "baseline": 0.0,
                            "title": f"'{column}' is almost the target",
                            "text": f"It correlates {correlation:.3f} with the target, "
                                    f"so a model can read the answer straight off it.",
                        })
            continue

        feature_text = feature.astype(str)
        distinct = feature.nunique()
        feature_words = {canonical_key(v) for v in feature_text.unique()}

        # Rows where the feature is missing tell us nothing about whether it
        # gives the answer away, so they are left out of the comparison.
        keep = feature.notna() & df[target].notna()
        if keep.sum() < 10:
            continue
        feature_text = feature_text[keep]
        target_for_feature = target_text[keep]

        # Way 1: the column uses the target's own words. "Engines" that says
        # "Diesel" and "Petrol", under a target of "Fuel Types", is a copy
        # wearing a disguise.
        shares_words = (
            len(feature_words) >= 2
            and bool(feature_words)
            and feature_words.issubset(target_words)
        )
        if not shares_words and len(feature_words) >= 2:
            # Not the same words, but every value still names a label:
            # "Diesel Engine", "Petrol Engine" and so on.
            values = [v for v in feature_text.unique() if canonical_key(v)]
            shares_words = all(_names_a_target_label(v, target_words) for v in values)

        # Way 2: the column has the target's exact shape and the same
        # mapping, but different words. A copy renamed.
        same_shape = distinct == target_classes and distinct >= 2
        score = _purity(feature_text, target_for_feature)
        looks_copied = same_shape and score >= COPY_PURITY

        if not (shares_words or looks_copied):
            # It is a feature, not a copy. Predicting the target well is
            # exactly what a feature is for, and dropping it would leave the
            # model with nothing.
            continue

        if shares_words:
            severity = "direct"
            detail = (f"'{column}' contains the target's own labels"
                      f"{f' ({_names(feature_words, 4)})' if len(feature_words) <= 4 else ''}. "
                      f"A model would not be learning a pattern, it would be reading "
                      f"the answer off a second column. Drop it before training.")
        else:
            severity = "partial"
            detail = (f"'{column}' has exactly the same shape as the target "
                      f"({distinct} values, each mapping onto one answer, right "
                      f"{score:.0%} of the time). It looks like the target under "
                      f"another name, so a model would not really be learning "
                      f"anything. Drop it before training.")

        findings.append({
            "column": column,
            "level": "warn",
            "severity": severity,
            "purity": round(float(score), 3),
            "baseline": round(float(baseline), 3),
            "title": f"'{column}' gives the answer away",
            "text": detail,
        })

    return findings
