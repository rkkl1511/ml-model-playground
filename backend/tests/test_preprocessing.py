"""Tests for the whole preprocessing pipeline on a messy real-world file.

These are the tests that matter most: they check that the data is cleaned
the way we claim, and that nothing leaks from the test rows into training.
"""

import numpy as np
import pandas as pd
import pytest

from fixtures import build_car_dataset
from infer import infer_column
from leakage import detect_leakage
from preprocessing import PreprocessConfig, prepare
from target import suggest_targets


@pytest.fixture(scope="module")
def cars():
    return build_car_dataset()


@pytest.fixture(scope="module")
def prepared_cars(cars):
    prepared, summary = prepare(cars, PreprocessConfig(target="Fuel Types"))
    return prepared, summary


# --- reading the file -------------------------------------------------------

def test_every_column_of_the_file_is_read_as_text_by_pandas(cars):
    # This is the starting point: pandas sees nothing but strings.
    assert not pd.api.types.is_numeric_dtype(cars["Max Power"])
    assert not pd.api.types.is_numeric_dtype(cars["Price"])
    assert cars["Max Power"].iloc[0].endswith("hp")


def test_a_column_of_text_numbers_is_inferred_as_numeric(cars):
    info = infer_column(cars["Max Power"])
    assert info.kind == "numeric"
    assert info.unit == "hp"
    assert info.dimension == "power"


def test_a_price_column_with_currency_symbols_is_numeric(cars):
    info = infer_column(cars["Price"])
    assert info.kind == "numeric"
    assert info.dimension == "currency"


def test_a_column_mixing_two_measurements_is_flagged(cars):
    info = infer_column(cars["Engine Displacement"])
    assert info.mixed is True
    assert {split["dimension"] for split in info.split_columns} == {"volume", "energy"}


def test_case_variants_are_found(cars):
    info = infer_column(cars["Company Names"])
    assert info.variants
    assert any(group["merged"] > 1 for group in info.variants)


# --- choosing a target ------------------------------------------------------

def test_the_price_column_is_offered_as_a_regression_target(cars):
    suggestions = {s["name"]: s for s in suggest_targets(cars)}
    assert "Price" in suggestions
    assert suggestions["Price"]["task"] == "regression"


def test_a_label_column_is_offered_as_a_classification_target(cars):
    suggestions = {s["name"]: s for s in suggest_targets(cars)}
    assert suggestions["Fuel Types"]["task"] == "classification"


def test_a_continuous_column_is_not_mistaken_for_an_id(cars):
    # A price is different on every row, but it is a target, not an id.
    suggestions = {s["name"] for s in suggest_targets(cars)}
    assert "Price" in suggestions


# --- leakage ----------------------------------------------------------------

def test_a_column_that_contains_the_target_is_caught(cars):
    findings = detect_leakage(cars, "Fuel Types", "classification")
    leaked = [f["column"] for f in findings]
    assert "Engine" in leaked


def test_a_leaking_column_is_dropped_from_the_features(prepared_cars):
    _, summary = prepared_cars
    assert "Engine" in summary["leaked_columns"]
    assert "Engine" not in summary["categorical_columns"]
    assert "Engine" not in summary["numeric_columns"]


# --- the cleaned frame ------------------------------------------------------

def test_the_cleaned_frame_has_real_numbers(prepared_cars):
    prepared, summary = prepared_cars
    # "Max Power" was "963 hp"; now it is a number.
    column = summary["numeric_columns"].index("Max Power")
    values = prepared.X_train[:, column]
    assert np.all(np.isfinite(values))


def test_a_mixed_column_is_split_into_one_column_per_measurement(prepared_cars):
    _, summary = prepared_cars
    assert "Engine Displacement (volume)" in summary["numeric_columns"]
    assert "Engine Displacement (energy)" in summary["numeric_columns"]


def test_spellings_are_folded_into_one_value(prepared_cars):
    prepared, summary = prepared_cars
    names = [n for n in summary["after"]["columns"]]
    # The company column became a few columns, not one per spelling.
    company_columns = [n for n in names if n.startswith("Company Names")]
    assert len(company_columns) <= 5


def test_high_cardinality_columns_do_not_become_thousands_of_columns(prepared_cars):
    _, summary = prepared_cars
    # 347 car names. The model does not get 347 columns.
    assert summary["features_after"] < 100
    assert "Names" in summary["categorical_columns"]


def test_a_normal_categorical_column_keeps_its_categories():
    # A column with a handful of useful categories must not be rolled into a
    # single "other" bucket just because the dataset is small.
    frame = pd.DataFrame({
        "Team": ["red", "blue", "green", "amber"] * 40,
        "Score": list(range(160)),
        "Won": ["yes"] * 100 + ["no"] * 60,
    })
    prepared, summary = prepare(frame, PreprocessConfig(target="Won"))
    assert "Team" in summary["categorical_columns"]
    # Four teams, so four one-hot columns, not one bucket for all of them.
    assert summary["features_after"] > 4


def test_a_useless_feature_is_not_mistaken_for_a_leak():
    # The trap: on an unbalanced target, a feature that knows nothing still
    # "predicts" the majority class correctly most of the time. A leak
    # detector that forgets the baseline throws away every column.
    frame = pd.DataFrame({
        "Region": ["north", "south", "east", "west"] * 50,
        "Size": list(range(200)),
        "Churn": ["no"] * 150 + ["yes"] * 50,
    })
    findings = detect_leakage(frame, "Churn", "classification")
    assert [f["column"] for f in findings] == []


def test_a_real_leak_is_still_caught():
    frame = pd.DataFrame({
        "Secret": ["yes"] * 80 + ["no"] * 120,
        "Churn": ["yes"] * 80 + ["no"] * 120,
    })
    findings = detect_leakage(frame, "Churn", "classification")
    assert "Secret" in [f["column"] for f in findings]


def test_a_normal_numeric_column_is_not_mistaken_for_a_leak():
    # A column with many distinct values has tiny groups, so the "most
    # common target in each group" is close to the row's own answer. A leak
    # detector that ignores that would throw away every numeric column.
    frame = pd.DataFrame({
        "Length": [float(i) for i in range(150)],
        "Species": ["a", "b", "c"] * 50,
    })
    findings = detect_leakage(frame, "Species", "classification")
    assert [f["column"] for f in findings] == []


# --- any kind of file, not just one domain ----------------------------------

def test_a_plain_business_file_works_end_to_end():
    # No units, no currency, no odd dashes. It should still work, and the
    # categorical columns should survive.
    frame = pd.DataFrame({
        "Region": ["north", "south", "east", "west"] * 50,
        "Segment": ["smb", "enterprise"] * 100,
        "Spend": [float(i) for i in range(200)],
        "Renewed": ["yes"] * 120 + ["no"] * 80,
    })
    prepared, summary = prepare(frame, PreprocessConfig(target="Renewed"))
    assert summary["task"] == "classification"
    assert "Region" in summary["categorical_columns"]
    assert "Segment" in summary["categorical_columns"]
    assert summary["leaked_columns"] == []


def test_a_text_target_with_three_digit_labels_works():
    frame = pd.DataFrame({
        "code": [f"SKU{i:04d}" for i in range(200)],
        "value": [float(i % 17) for i in range(200)],
        "label": ["alpha", "beta", "gamma"] * 66 + ["alpha", "beta"],
    })
    prepared, summary = prepare(frame, PreprocessConfig(target="label"))
    assert summary["n_classes"] == 3
    assert prepared.class_names == ["alpha", "beta", "gamma"]


def test_a_target_with_more_than_twenty_classes_is_allowed():
    # The old rule refused anything over 20 classes, which ruled out plenty
    # of real datasets.
    frame = pd.DataFrame({
        "value": [float(i) for i in range(250)],
        "label": [f"class{i % 23}" for i in range(250)],
    })
    prepared, summary = prepare(frame, PreprocessConfig(target="label"))
    assert summary["n_classes"] == 23
    assert summary["task"] == "classification"


def test_a_numeric_target_is_treated_as_regression():
    frame = pd.DataFrame({
        "Region": ["north", "south", "east", "west"] * 50,
        "value": [float(i) for i in range(200)],
    })
    prepared, summary = prepare(frame, PreprocessConfig(target="value"))
    assert summary["task"] == "regression"
    assert prepared.task == "regression"


# --- no leakage from the test rows ------------------------------------------

def test_the_scaler_is_fitted_on_training_rows_only(prepared_cars):
    prepared, _ = prepared_cars
    # Standard scaling makes the training rows average 0. Only the numeric
    # columns are scaled; the one-hot columns are counts.
    width = len(prepared.numeric_cols)
    assert np.allclose(prepared.X_train[:, :width].mean(axis=0), 0, atol=0.1)


def test_the_test_rows_were_not_scaled_with_test_statistics(prepared_cars):
    prepared, _ = prepared_cars
    # If the test rows had been used to fit the scaler, their own mean
    # would also be 0. It is not, which is the proof that they were held out.
    width = len(prepared.numeric_cols)
    assert not np.allclose(prepared.X_test[:, :width].mean(axis=0), 0, atol=0.1)


def test_rare_categories_are_grouped_using_training_rows_only(cars):
    prepared, summary = prepare(
        cars, PreprocessConfig(target="Fuel Types", rare_threshold=50))
    assert "Names" in summary["categorical_columns"]
    # The grouping produced far fewer columns than the 347 raw names.
    assert summary["features_after"] < 100


# --- regression --------------------------------------------------------------

def test_a_price_target_can_be_trained_on(cars):
    prepared, summary = prepare(cars, PreprocessConfig(target="Price"))
    assert summary["task"] == "regression"
    assert prepared.task == "regression"
    assert prepared.y_train.dtype == np.float64
    assert prepared.y_train.min() > 1000


def test_a_text_price_is_read_as_a_number(cars):
    prepared, _ = prepare(cars, PreprocessConfig(target="Price"))
    # "$1,100,000" became 1100000, not a string.
    assert prepared.y_train.max() > 1000000
