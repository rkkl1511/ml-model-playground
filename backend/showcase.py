"""The results shown on the landing page.

The landing page used to show hardcoded numbers and a made-up matrix. That
is the sort of thing that looks fine until someone tries to reproduce it, so
this module runs a real model on a real dataset once, and the page shows
what actually came out.
"""

from preprocessing import PreprocessConfig, prepare
from samples import build_sample
from trainer import train_model

# The algorithms shown on the landing page, in the order they are listed.
SHOWCASE_MODELS = ["knn", "logistic_regression", "random_forest"]

_cache: dict | None = None


def _build() -> dict:
    frame = build_sample("iris")
    prepared, _ = prepare(frame, PreprocessConfig(target="species"))

    models = []
    for model_id in SHOWCASE_MODELS:
        result = train_model(model_id, prepared)["result"]
        models.append({
            "id": model_id,
            "label": result["label"],
            "score": result["cv"]["mean"] if result.get("cv") else result["test_accuracy"],
        })

    best = train_model("random_forest", prepared)["result"]
    return {
        "dataset": "iris",
        "best_score": max(m["score"] for m in models),
        "baseline": best["baseline_accuracy"],
        "models": models,
        "confusion_matrix": best["confusion_matrix"],
        "class_names": best["class_names"],
    }


def get_showcase() -> dict:
    """The landing page numbers, worked out once and kept."""
    global _cache
    if _cache is None:
        _cache = _build()
    return _cache
