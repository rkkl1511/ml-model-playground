"""Train one model on the prepared data and measure how well it did.

Two kinds of job live here. A classifier predicts a label, and we measure it
with accuracy plus precision, recall and F1. A regressor predicts a number,
and we measure it with R-squared, mean absolute error and RMSE.

Both are compared against a baseline: a model that knows nothing. For a
classifier that is "always guess the most common class"; for a regressor it
is "always guess the average". A model that cannot beat that has learned
nothing, however good the score looks on its own.
"""

import time

import numpy as np
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)

from models import MODELS, build_model


def _pct(value: float) -> float:
    return round(float(value) * 100, 1)


def _verdict(train_acc: float, test_acc: float, baseline_acc: float) -> dict:
    train, test, base = _pct(train_acc), _pct(test_acc), _pct(baseline_acc)

    if test_acc < baseline_acc - 0.02:
        return {
            "tone": "bad",
            "title": "Worse than guessing",
            "text": f"Always guessing the most common class scores {base:g}%, and this "
                    f"model scores {test:g}%. It did not just fail to learn, it picked up "
                    f"patterns that do not hold on new rows. That usually means the "
                    f"columns are not what the model needs, or there is too little "
                    f"data for the pattern to be real.",
        }
    if test_acc <= baseline_acc + 0.01:
        return {
            "tone": "bad",
            "title": "No better than guessing",
            "text": f"Always guessing the most common class scores {base:g}% and this model scores "
                    f"{test:g}%. It hasn't learned much. Check your target and features.",
        }
    if train_acc - test_acc > 0.15:
        return {
            "tone": "mid",
            "title": "Possible overfitting",
            "text": f"{train:g}% on rows it studied but only {test:g}% on new rows. It may have "
                    "memorized the training data instead of learning patterns that carry over.",
        }
    if test_acc < 0.70:
        return {
            "tone": "mid",
            "title": "Weak signal",
            "text": f"{test:g}% on new rows, against {base:g}% for guessing. The model is "
                    f"beating the baseline, but not by much. There may simply not be much "
                    f"in these columns to predict the target with.",
        }
    return {
        "tone": "good",
        "title": "Learned something real",
        "text": f"{test:g}% on new rows, well above the {base:g}% you'd get by guessing, with a small "
                "gap between training and test scores.",
    }


def _regression_verdict(r2: float, mae: float, baseline_mae: float) -> dict:
    if baseline_mae <= 0 or mae > baseline_mae * 1.02:
        if baseline_mae <= 0:
            return {
                "tone": "bad",
                "title": "Nothing to compare against",
                "text": "The target has no variation to predict, so there is no way to "
                        "tell a good model from a bad one here.",
            }
        return {
            "tone": "bad",
            "title": "Worse than guessing the average",
            "text": f"Always predicting the average is off by {baseline_mae:,.0f} on "
                    f"average. This model is off by {mae:,.0f}, so it did not just fail "
                    f"to find the pattern, it found one that does not hold on new rows.",
        }
    if r2 < 0:
        return {
            "tone": "bad",
            "title": "Worse than predicting the average",
            "text": f"An R-squared of {r2:.2f} means the model is doing worse than "
                    f"simply guessing the average for every row. It found a pattern "
                    f"that does not hold on new rows.",
        }
    if r2 < 0.5:
        return {
            "tone": "mid",
            "title": "Explains only some of it",
            "text": f"R-squared {r2:.2f}: the model catches {r2:.0%} of the variation in "
                    f"the target, and is off by {mae:,.0f} on a typical row. There is "
                    f"probably more signal in the data.",
        }
    return {
        "tone": "good",
        "title": "Learned something real",
        "text": f"R-squared {r2:.2f}: the model explains {r2:.0%} of the variation in "
                f"the target, and beats the average by {100 * (1 - mae / baseline_mae):.0%}.",
    }


def _classification_result(model_id, model, prepared, fit_ms, y_pred) -> dict:
    y_train = prepared.y_train
    y_test = prepared.y_test

    train_acc = accuracy_score(y_train, model.predict(prepared.X_train))
    test_acc = accuracy_score(y_test, y_pred)

    # The "dumbest possible model": always predict the most common training class.
    # Any real model must beat this to be worth anything.
    dummy = DummyClassifier(strategy="most_frequent").fit(
        prepared.X_train, prepared.y_train)
    baseline_acc = accuracy_score(y_test, dummy.predict(prepared.X_test))

    n_test = len(y_test)
    labels = list(range(len(prepared.class_names)))
    matrix = confusion_matrix(y_test, y_pred, labels=labels).tolist()

    precision = precision_score(y_test, y_pred, average="macro",
                                zero_division=0)
    recall = recall_score(y_test, y_pred, average="macro", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="macro", zero_division=0)

    return {
        "model_id": model_id,
        "label": MODELS[model_id]["label"],
        "task": "classification",
        "train_accuracy": _pct(train_acc),
        "test_accuracy": _pct(test_acc),
        "baseline_accuracy": _pct(baseline_acc),
        "precision": _pct(precision),
        "recall": _pct(recall),
        "f1": _pct(f1),
        "correct": int((y_pred == y_test).sum()),
        "test_rows": int(n_test),
        "fit_ms": round(fit_ms, 1),
        "points_per_row": round(100 / n_test, 1),
        "confusion_matrix": matrix,
        "class_names": prepared.class_names,
        "verdict": _verdict(train_acc, test_acc, baseline_acc),
    }


def _regression_result(model_id, model, prepared, fit_ms, y_pred) -> dict:
    y_train = prepared.y_train
    y_test = prepared.y_test

    train_r2 = r2_score(y_train, model.predict(prepared.X_train))
    test_r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

    # The baseline: always guess the average of the training rows.
    dummy = DummyRegressor(strategy="mean").fit(
        prepared.X_train, prepared.y_train)
    baseline_pred = dummy.predict(prepared.X_test)
    baseline_mae = mean_absolute_error(y_test, baseline_pred)
    baseline_r2 = r2_score(y_test, baseline_pred)

    return {
        "model_id": model_id,
        "label": MODELS[model_id]["label"],
        "task": "regression",
        "train_r2": round(float(train_r2), 3),
        "test_r2": round(float(test_r2), 3),
        "mae": round(float(mae), 2),
        "rmse": round(float(rmse), 2),
        "baseline_mae": round(float(baseline_mae), 2),
        "baseline_r2": round(float(baseline_r2), 3),
        "test_rows": int(len(y_test)),
        "fit_ms": round(fit_ms, 1),
        "target_mean": round(float(np.mean(y_test)), 2),
        "verdict": _regression_verdict(test_r2, mae, baseline_mae),
    }


def _add_leak_note(result: dict, prepared) -> dict:
    """Mention any columns we left out because they gave the target away.

    A low score is often the doing of the columns we removed, and the user
    deserves to know that rather than to wonder what they did wrong.
    """
    leaked = getattr(prepared, "dropped_leaks", None)
    if not leaked:
        return result
    names = ", ".join(f"'{name}'" for name in leaked[:3])
    result["verdict"] = dict(result["verdict"])
    result["verdict"]["text"] += (
        f" Note: {names} {'were' if len(leaked) > 1 else 'was'} left out because it "
        f"gave the answer away, so the model had less to learn from. Turn off "
        f"'Drop columns that give the answer away' in the preparation step to see "
        f"the difference."
    )
    return result


def train_model(model_id: str, prepared) -> dict:
    model = build_model(model_id, prepared.config.random_state)

    start = time.perf_counter()
    model.fit(prepared.X_train, prepared.y_train)
    fit_ms = (time.perf_counter() - start) * 1000

    y_pred = model.predict(prepared.X_test)

    if prepared.task == "regression":
        result = _regression_result(model_id, model, prepared, fit_ms, y_pred)
    else:
        result = _classification_result(model_id, model, prepared, fit_ms, y_pred)

    result = _add_leak_note(result, prepared)

    # Keep the fitted model and its predictions: later steps build the
    # confusion matrix from them and use them for the prediction demo.
    return {"model": model, "y_pred": y_pred, "result": result}
