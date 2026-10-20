"""Tests for cross-validation.

The point of cross-validation is to get a score you can trust, and the one
way to ruin that is to let the folds see each other. These tests check that
the whole pipeline is rebuilt inside every fold, and that the number the app
reports is the one a careful practitioner would get.
"""

import numpy as np
import pandas as pd
import pytest
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline

from models import build_model
from preprocessing import PreprocessConfig, prepare
from trainer import _fresh_pipeline, cross_validate_model, train_model


@pytest.fixture(scope="module")
def iris():
    from samples import build_sample
    return build_sample("iris")


def test_cross_validation_returns_a_score_for_every_fold(iris):
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]

    cv = result["cv"]
    assert cv is not None
    assert cv["n_splits"] == 5
    assert len(cv["folds"]) == 5
    # The mean is the mean of the folds, and the spread is the spread.
    assert cv["mean"] == pytest.approx(np.mean(cv["folds"]), abs=0.01)
    assert cv["std"] == pytest.approx(np.std(cv["folds"]), abs=0.01)
    assert cv["metric"] == "accuracy"


def test_the_baseline_is_cross_validated_as_well(iris):
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]

    cv_baseline = result["cv_baseline"]
    assert cv_baseline is not None
    # The baseline is "always guess the most common class", so it should sit
    # at the share of that class and never move.
    counts = np.bincount(prepared.y_train)
    majority = counts.max() / counts.sum() * 100
    assert cv_baseline["mean"] == pytest.approx(majority, abs=0.5)
    assert cv_baseline["std"] == pytest.approx(0.0, abs=0.01)


def test_every_fold_rebuilds_the_whole_pipeline(iris):
    # If the preprocessor were fitted once on all the training rows and then
    # reused inside the folds, the other folds would leak into each one.
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))

    pipeline = _fresh_pipeline(prepared, build_model("random_forest", 42))
    assert isinstance(pipeline, Pipeline)
    # A fresh preprocessor has nothing fitted into it yet.
    assert not hasattr(pipeline.named_steps["prep"], "transformers_")

    # And the cross-validator is handed the un-encoded columns, so the
    # pipeline can do the encoding itself, fold by fold.
    assert isinstance(prepared.X_train_raw, pd.DataFrame)
    assert "sepal length (cm)" in prepared.X_train_raw.columns
    assert prepared.X_train_raw.shape[1] == len(prepared.numeric_cols)


def test_the_folds_are_refitted_properly(iris):
    # Run the cross-validation by hand and check the app's number matches.
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    pipeline = _fresh_pipeline(prepared, build_model("random_forest", 42))
    splitter = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    scores = cross_validate(
        pipeline, prepared.X_train_raw, prepared.y_train,
        cv=splitter, scoring="accuracy", error_score="raise")

    expected = float(np.mean(scores["test_score"]) * 100)
    actual = cross_validate_model("random_forest", prepared)
    assert actual["mean"] == pytest.approx(expected, abs=0.01)


def test_the_score_agrees_with_the_holdout(iris):
    # Both numbers estimate the same thing, so they should be close. If they
    # are far apart, something is wrong with one of them.
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]
    assert result["cv"]["mean"] == pytest.approx(result["test_accuracy"], abs=15)


def test_cross_validation_can_be_turned_off(iris):
    prepared, _ = prepare(iris, PreprocessConfig(target="species", cv_folds=0))
    result = train_model("random_forest", prepared)["result"]
    assert result["cv"] is None
    # The verdict falls back to the single split and says which it used.
    assert "held-out test rows" in result["verdict"]["text"]


def test_too_few_rows_for_a_class_to_fold(iris):
    # A class with two rows cannot be split into five folds. We use fewer
    # folds rather than failing.
    frame = pd.DataFrame({
        "value": [float(i) for i in range(40)],
        "label": ["a"] * 38 + ["b"] * 2,
    })
    prepared, _ = prepare(frame, PreprocessConfig(target="label"))
    result = train_model("decision_tree", prepared)["result"]
    if result["cv"] is not None:
        assert result["cv"]["n_splits"] <= 2


def test_regression_is_cross_validated_too():
    # A noisy relationship: "x" is a genuinely useful feature, not a copy of
    # the target, so it should survive the leak check.
    rng = np.random.default_rng(0)
    x = rng.normal(0, 1, 80)
    frame = pd.DataFrame({
        "x": x,
        "z": rng.normal(0, 1, 80),
        "y": 3 * x + rng.normal(0, 0.5, 80),
    })
    prepared, _ = prepare(frame, PreprocessConfig(target="y"))
    result = train_model("linear_regression", prepared)["result"]

    assert result["task"] == "regression"
    assert result["cv"] is not None
    assert result["cv"]["metric"] == "r2"
    # The relationship is a straight line, so the score should be near 1.
    assert result["cv"]["mean"] > 0.8


def test_a_regression_baseline_sits_at_zero():
    # "Always predict the average" has an R-squared of about zero. Not
    # exactly zero: the average comes from the fold's training rows, so it
    # is very slightly off for the rows it is then judged on.
    rng = np.random.default_rng(1)
    frame = pd.DataFrame({
        "x": rng.normal(0, 1, 80),
        "y": rng.normal(0, 1, 80),
    })
    prepared, _ = prepare(frame, PreprocessConfig(target="y"))
    result = train_model("linear_regression", prepared)["result"]
    assert abs(result["cv_baseline"]["mean"]) < 0.5
    # And the real model beats it, which is the only thing that matters.
    assert result["cv"]["mean"] > result["cv_baseline"]["mean"]


def test_a_duplicate_of_a_numeric_target_is_caught():
    # "Price" and "Price in lakhs" are the same number. A model would read
    # the answer off the second column.
    frame = pd.DataFrame({
        "Price": [float(i * 1000) for i in range(60)],
        "Price in lakhs": [float(i) for i in range(60)],
        "Rooms": [float(i % 5) for i in range(60)],
    })
    prepared, summary = prepare(frame, PreprocessConfig(target="Price"))
    assert "Price in lakhs" in summary["leaked_columns"]
    # But a merely useful feature is left alone.
    assert "Rooms" not in summary["leaked_columns"]
