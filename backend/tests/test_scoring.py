"""Tests for the scoring and the verdicts that explain it.

A score means nothing on its own. The whole point of this app is that every
number comes with the baseline it has to beat, and a plain-language
explanation of what the score means.
"""

import numpy as np
import pandas as pd
import pytest

from leakage import detect_leakage
from preprocessing import PreprocessConfig, prepare
from trainer import train_model


@pytest.fixture(scope="module")
def iris():
    from samples import build_sample
    return build_sample("iris")


def test_a_classifier_is_scored_against_the_majority_class(iris):
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]

    assert result["task"] == "classification"
    assert result["baseline_accuracy"] > 0
    # A model that cannot beat "always guess the most common flower" has
    # learned nothing.
    assert result["test_accuracy"] > result["baseline_accuracy"]
    assert result["verdict"]["tone"] == "good"


def test_a_confusion_matrix_comes_back_with_the_result(iris):
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]

    names = prepared.class_names
    matrix = result["confusion_matrix"]
    assert len(matrix) == len(names)
    assert all(len(row) == len(names) for row in matrix)
    # The diagonal holds the correct answers, and it must add up.
    assert sum(matrix[i][i] for i in range(len(names))) == result["correct"]
    # Every test row is accounted for exactly once.
    assert sum(sum(row) for row in matrix) == result["test_rows"]


def test_precision_recall_and_f1_are_reported(iris):
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]
    for field in ("precision", "recall", "f1"):
        assert 0 <= result[field] <= 100


def test_a_regressor_is_scored_against_the_average(iris):
    frame = iris.copy()
    frame["length"] = frame["sepal length (cm)"] * 10 + frame["sepal width (cm)"]
    prepared, summary = prepare(frame, PreprocessConfig(target="length"))

    assert summary["task"] == "regression"
    result = train_model("linear_regression", prepared)["result"]
    assert result["task"] == "regression"
    assert result["baseline_mae"] > 0
    # A model that cannot beat the average has learned nothing.
    assert result["mae"] < result["baseline_mae"]


def test_a_model_worse_than_the_baseline_says_so():
    # A model that scores below the baseline is not just "no better than
    # guessing": it found a pattern that does not hold. The verdict has to
    # tell the user which of the two it is.
    from trainer import _verdict
    verdict = _verdict(0.9, 0.2, 0.4)
    assert verdict["title"] == "Worse than guessing"
    assert verdict["tone"] == "bad"


def test_a_model_that_only_matches_the_baseline_says_so():
    from trainer import _verdict
    verdict = _verdict(0.5, 0.4, 0.4)
    assert verdict["title"] == "No better than guessing"


def test_a_weak_but_real_signal_says_so():
    from trainer import _verdict
    verdict = _verdict(0.5, 0.5, 0.3)
    assert verdict["title"] == "Weak signal"
    assert verdict["tone"] == "mid"


def test_a_regression_worse_than_the_average_says_so():
    from trainer import _regression_verdict
    verdict = _regression_verdict(-0.2, 500, 300)
    assert verdict["title"] == "Worse than guessing the average"
    assert verdict["tone"] == "bad"


def test_a_classifier_cannot_be_trained_on_a_regression_target(iris):
    from models import supports_task
    assert supports_task("random_forest", "classification") is True
    assert supports_task("random_forest", "regression") is False
    assert supports_task("ridge", "regression") is True
    assert supports_task("ridge", "classification") is False


def test_a_low_score_explains_that_a_leaky_column_was_removed():
    # The feature carries the target's own labels, so it is a copy in
    # disguise and gets dropped. What is left is noise, and the model scores
    # badly. The user has to be told that, or they think the tool is broken.
    rng = np.random.default_rng(3)
    churn = ["yes"] * 75 + ["no"] * 75
    rng.shuffle(churn)
    frame = pd.DataFrame({
        "Status": churn,
        "Noise": rng.normal(0, 1, 150),
        "Churn": churn,
    })
    prepared, summary = prepare(frame, PreprocessConfig(target="Churn"))
    assert "Status" in summary["leaked_columns"]

    result = train_model("random_forest", prepared)["result"]
    assert "Status" in result["verdict"]["text"]
    assert "gave the answer away" in result["verdict"]["text"]


def test_turning_off_the_leak_drop_keeps_the_column():
    frame = pd.DataFrame({
        "Status": ["yes"] * 75 + ["no"] * 75,
        "Churn": ["yes"] * 75 + ["no"] * 75,
    })
    prepared, summary = prepare(
        frame, PreprocessConfig(target="Churn", drop_leaky=False))
    assert summary["leaked_columns"] == ["Status"]
    assert "Status" in summary["categorical_columns"]
    # With the copied column kept, the model finds the pattern.
    result = train_model("random_forest", prepared)["result"]
    assert result["test_accuracy"] > result["baseline_accuracy"]


def test_a_strong_predictor_is_kept_because_it_is_a_feature_not_a_copy():
    # "Colour" tells you the answer, but it does not contain the answer's
    # own labels. That is a perfectly good feature, and dropping it would
    # leave the model with nothing to learn from.
    frame = pd.DataFrame({
        "Colour": ["red", "blue", "green"] * 50,
        "Churn": ["yes" if c == "red" else "no" for c in ["red", "blue", "green"] * 50],
    })
    prepared, summary = prepare(frame, PreprocessConfig(target="Churn"))
    assert summary["leaked_columns"] == []
    assert "Colour" in summary["categorical_columns"]

    result = train_model("random_forest", prepared)["result"]
    assert result["test_accuracy"] > result["baseline_accuracy"]


def test_a_copied_column_with_renamed_labels_is_still_caught():
    # Same shape, same mapping, different words: still a copy.
    frame = pd.DataFrame({
        "Grade": ["A", "B", "C"] * 50,
        "Result": ["pass", "fail", "maybe"] * 50,
    })
    findings = detect_leakage(frame, "Result", "classification")
    assert "Grade" in [f["column"] for f in findings]
