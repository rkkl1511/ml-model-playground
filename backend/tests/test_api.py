"""Tests for the HTTP layer, so the API contract stays honest."""

import io

import pytest
from fastapi.testclient import TestClient

from fixtures import build_car_dataset
from main import app

client = TestClient(app)


def upload_cars():
    """Send the messy car file through the upload endpoint, as a user would."""
    frame = build_car_dataset()
    buffer = io.StringIO()
    frame.to_csv(buffer, index=False)
    raw = buffer.getvalue().encode("utf-8")
    response = client.post(
        "/api/upload",
        files={"file": ("cars.csv", raw, "text/csv")},
    )
    assert response.status_code == 200
    return response.json()


def test_health_is_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_samples_are_listed():
    response = client.get("/api/samples")
    assert response.status_code == 200
    ids = [s["id"] for s in response.json()]
    assert "iris" in ids
    assert "car_market" in ids


def test_the_messy_sample_can_be_loaded():
    response = client.post("/api/samples/car_market")
    assert response.status_code == 200
    body = response.json()
    assert body["rows"] == 420
    # The price column is offered as a regression target.
    assert body["suggested_target"] == "Price"


def test_uploading_a_file_returns_a_summary_with_target_suggestions():
    body = upload_cars()
    assert body["rows"] == 420
    names = {s["name"] for s in body["target_suggestions"]}
    assert "Price" in names
    assert "Fuel Types" in names

    # The summary tells the user that a text column is really a number.
    columns = {c["name"]: c for c in body["columns"]}
    assert columns["Max Power"]["kind"] == "numeric"
    assert columns["Max Power"]["raw_kind"] == "categorical"
    assert columns["Max Power"]["unit"] == "hp"


def test_the_profile_reports_the_messy_parts():
    body = upload_cars()
    response = client.get(f"/api/datasets/{body['dataset_id']}/profile")
    assert response.status_code == 200
    profile = response.json()

    titles = [w["title"] for w in profile["warnings"]]
    assert "Numbers hiding in text" in titles
    assert "Same value, different spelling" in titles
    assert "Columns that mix different measurements" in titles


def test_preprocessing_a_regression_target():
    body = upload_cars()
    response = client.post(
        f"/api/datasets/{body['dataset_id']}/preprocess",
        json={"target": "Price"},
    )
    assert response.status_code == 200
    summary = response.json()
    assert summary["task"] == "regression"
    assert summary["train_rows"] + summary["test_rows"] == 420


def test_training_a_regression_model():
    body = upload_cars()
    client.post(f"/api/datasets/{body['dataset_id']}/preprocess",
                json={"target": "Price"})
    response = client.post(
        f"/api/datasets/{body['dataset_id']}/train",
        json={"model_id": "random_forest_regressor"},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["task"] == "regression"
    assert "test_r2" in result
    assert "mae" in result
    assert result["verdict"]["title"]


def test_a_classifier_cannot_be_used_for_a_regression_target():
    body = upload_cars()
    client.post(f"/api/datasets/{body['dataset_id']}/preprocess",
                json={"target": "Price"})
    response = client.post(
        f"/api/datasets/{body['dataset_id']}/train",
        json={"model_id": "random_forest"},
    )
    assert response.status_code == 400
    assert "cannot do regression" in response.json()["detail"]


def test_the_model_catalogue_can_be_filtered_by_task():
    classifiers = client.get("/api/models", params={"task": "classification"}).json()
    regressors = client.get("/api/models", params={"task": "regression"}).json()

    assert all("classification" in m["tasks"] for m in classifiers)
    assert all("regression" in m["tasks"] for m in regressors)
    assert {m["id"] for m in classifiers} & {m["id"] for m in regressors} == set()


def test_training_before_preparing_is_refused():
    body = upload_cars()
    response = client.post(
        f"/api/datasets/{body['dataset_id']}/train",
        json={"model_id": "random_forest"},
    )
    assert response.status_code == 409


def test_an_unknown_dataset_is_refused():
    response = client.post(
        "/api/datasets/does-not-exist/train",
        json={"model_id": "random_forest"},
    )
    assert response.status_code == 404


def test_a_non_csv_upload_is_refused():
    response = client.post(
        "/api/upload",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400


def test_the_iris_sample_still_trains():
    body = client.post("/api/samples/iris").json()
    client.post(f"/api/datasets/{body['dataset_id']}/preprocess",
                json={"target": "species"})
    response = client.post(
        f"/api/datasets/{body['dataset_id']}/train",
        json={"model_id": "random_forest"},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["task"] == "classification"
    # A confusion matrix comes back with the result.
    assert len(result["confusion_matrix"]) == 3
    assert result["class_names"] == ["setosa", "versicolor", "virginica"]
    # And it beats the "always guess the most common class" baseline.
    assert result["test_accuracy"] > result["baseline_accuracy"]


def test_training_reports_a_cross_validated_score():
    body = client.post("/api/samples/iris").json()
    client.post(f"/api/datasets/{body['dataset_id']}/preprocess",
                json={"target": "species"})
    result = client.post(
        f"/api/datasets/{body['dataset_id']}/train",
        json={"model_id": "random_forest"},
    ).json()

    cv = result["cv"]
    assert cv is not None
    assert cv["metric"] == "accuracy"
    assert cv["n_splits"] == 5
    assert len(cv["folds"]) == 5
    assert all(0 <= fold <= 100 for fold in cv["folds"])
    assert cv["mean"] == pytest.approx(sum(cv["folds"]) / 5, abs=0.01)

    # The baseline is cross-validated the same way, so the two can be
    # compared like with like.
    assert result["cv_baseline"]["mean"] == pytest.approx(
        result["baseline_accuracy"], abs=2)

    # And the verdict says which number it is talking about.
    assert "Cross-validated" in result["verdict"]["text"]


def test_cross_validation_can_be_switched_off():
    body = client.post("/api/samples/iris").json()
    client.post(f"/api/datasets/{body['dataset_id']}/preprocess",
                json={"target": "species", "cv_folds": 0})
    result = client.post(
        f"/api/datasets/{body['dataset_id']}/train",
        json={"model_id": "random_forest"},
    ).json()
    assert result["cv"] is None
    assert "held-out test rows" in result["verdict"]["text"]


def test_a_regression_model_is_cross_validated_too():
    body = client.post("/api/samples/car_market").json()
    client.post(f"/api/datasets/{body['dataset_id']}/preprocess",
                json={"target": "Price"})
    result = client.post(
        f"/api/datasets/{body['dataset_id']}/train",
        json={"model_id": "random_forest_regressor"},
    ).json()
    assert result["cv"]["metric"] == "r2"
    assert len(result["cv"]["folds"]) == 5
    # R-squared is a ratio, so it is not turned into a percentage.
    assert all(-5 < fold < 5 for fold in result["cv"]["folds"])
