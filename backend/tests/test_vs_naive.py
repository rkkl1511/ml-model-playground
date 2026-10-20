"""The playground must never score worse than a plain, naive pipeline.

The smart parts of this app (reading numbers out of text, folding spelling
variants, finding copies of the target) exist to make results *better*, not
worse. This file pins that down: for a spread of datasets, the playground's
score has to be at least as good as the textbook sklearn pipeline on the same
data, and better wherever the messy formatting used to get in the way.
"""

import numpy as np
import pandas as pd
import pytest
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler

from preprocessing import PreprocessConfig, prepare
from trainer import train_model


def naive_score(df, target, seed=42):
    """The textbook pipeline: no parsing, no folding, no leak checks."""
    data = df.dropna(subset=[target]).copy()
    y = LabelEncoder().fit_transform(data[target].astype(str))
    X = data.drop(columns=[target])
    cat = [c for c in X.columns if not pd.api.types.is_numeric_dtype(X[c])]
    num = [c for c in X.columns if c not in cat]
    pre = ColumnTransformer([
        ("num", Pipeline([("i", SimpleImputer(strategy="median")),
                          ("s", StandardScaler())]), num),
        ("cat", Pipeline([("i", SimpleImputer(strategy="most_frequent")),
                          ("o", OneHotEncoder(handle_unknown="ignore",
                                             sparse_output=False))]), cat),
    ])
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=seed,
                                          stratify=y)
    pre.fit(Xtr)
    model = RandomForestClassifier(n_estimators=100, random_state=seed).fit(
        np.asarray(pre.transform(Xtr), dtype=float), ytr)
    return model.score(np.asarray(pre.transform(Xte), dtype=float), yte) * 100


def playground_score(df, target):
    prepared, summary = prepare(df, PreprocessConfig(target=target))
    result = train_model("random_forest", prepared)["result"]
    return result["test_accuracy"], result["baseline_accuracy"], summary


@pytest.fixture(scope="module")
def rng():
    return np.random.default_rng(0)


def test_clean_numeric_data_is_as_good_as_the_naive_pipeline(rng):
    n = 400
    frame = pd.DataFrame({
        "a": rng.normal(0, 1, n),
        "b": rng.normal(0, 1, n),
        "c": rng.normal(0, 1, n),
    })
    frame["target"] = np.where(frame["a"] + frame["b"] > 0, "high", "low")

    naive = naive_score(frame, "target")
    mine, base, _ = playground_score(frame, "target")
    assert mine >= naive - 1.0


def test_a_categorical_predictor_is_kept(rng):
    # "Colour" is a perfectly good feature. Dropping it would leave the
    # model with nothing to learn from.
    n = 300
    frame = pd.DataFrame({
        "colour": rng.choice(["red", "blue", "green"], n),
        "size": rng.choice(["s", "m", "l"], n),
    })
    frame["target"] = np.where(frame["colour"] == "red", "yes", "no")

    naive = naive_score(frame, "target")
    mine, base, summary = playground_score(frame, "target")
    assert summary["leaked_columns"] == []
    assert mine >= naive - 1.0
    assert mine > base


def test_numbers_written_with_units_are_better_than_the_naive_pipeline(rng):
    n = 300
    frame = pd.DataFrame({
        "size": [f"{v} kg" for v in rng.integers(10, 100, n)],
        "colour": rng.choice(["red", "blue", "green"], n),
    })
    frame["target"] = np.where(
        np.array([int(v.split()[0]) > 55 for v in frame["size"]]), "big", "small")

    naive = naive_score(frame, "target")
    mine, base, _ = playground_score(frame, "target")
    # The naive pipeline cannot read "72 kg" as a number, so it does much
    # worse. This is the whole point of the app.
    assert mine > naive
    assert mine > base


def test_currency_and_case_variants_are_better_than_the_naive_pipeline(rng):
    n = 300
    frame = pd.DataFrame({
        "city": rng.choice(["Delhi", "delhi", "DELHI", "Pune", "pune"], n),
        "income": [f"${v:,}" for v in rng.integers(20000, 90000, n)],
    })
    frame["target"] = np.where(
        np.array([int(v[1:].replace(",", "")) for v in frame["income"]]) > 55000,
        "rich", "poor")

    naive = naive_score(frame, "target")
    mine, base, _ = playground_score(frame, "target")
    assert mine > naive
    assert mine > base


def test_many_categories_do_not_hurt(rng):
    n = 400
    frame = pd.DataFrame({
        "brand": rng.choice([f"brand{i}" for i in range(40)], n),
        "score": rng.normal(0, 1, n),
    })
    frame["target"] = np.where(frame["score"] > 0, "up", "down")

    naive = naive_score(frame, "target")
    mine, base, _ = playground_score(frame, "target")
    assert mine >= naive - 1.0
    assert mine > base


def test_a_copy_of_the_target_is_still_dropped(rng):
    n = 300
    churn = ["yes"] * 150 + ["no"] * 150
    rng.shuffle(churn)
    frame = pd.DataFrame({
        "Status": churn,
        "Noise": rng.normal(0, 1, n),
        "Churn": churn,
    })
    _, _, summary = playground_score(frame, "Churn")
    assert "Status" in summary["leaked_columns"]
