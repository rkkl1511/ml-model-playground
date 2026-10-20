"""The model registry: every algorithm the playground offers.

To add an algorithm later, add one entry here. Nothing else needs to change.

Each entry says which task it can do. A classifier predicts a label, a
regressor predicts a number, and the playground only offers what fits the
task the user's data calls for.
"""

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

MODELS = {
    "logistic_regression": {
        "label": "Logistic Regression",
        "tagline": "Draws straight boundaries between classes",
        "how_it_thinks": (
            "Gives every feature a weight, adds them up, and squashes the total into a "
            "probability between 0 and 1. Training nudges the weights until the "
            "probabilities match the real answers."
        ),
        "strengths": ["Very fast", "Weights are easy to read", "Gives probabilities"],
        "weaknesses": ["Only straight boundaries", "Likes scaled features"],
        "tasks": ["classification"],
        "build": lambda seed: LogisticRegression(max_iter=1000),
    },
    "knn": {
        "label": "K-Nearest Neighbors",
        "tagline": "Asks the most similar rows",
        "how_it_thinks": (
            "Has no real training step: it just memorizes the training rows. To predict, "
            "it finds the 5 closest rows and lets them vote."
        ),
        "strengths": ["Simple idea", "Handles curvy boundaries"],
        "weaknesses": ["Slow on big data", "Hurt by unscaled or useless columns"],
        "tasks": ["classification"],
        "build": lambda seed: KNeighborsClassifier(n_neighbors=5),
    },
    "random_forest": {
        "label": "Random Forest",
        "tagline": "A crowd of decision trees voting",
        "how_it_thinks": (
            "Grows 100 decision trees, each on a random sample of rows and columns, and "
            "lets them vote. Each tree is a bit wrong in its own way, so the crowd "
            "is usually right."
        ),
        "strengths": ["Strong default choice", "Resists overfitting", "Ranks feature importance"],
        "weaknesses": ["Harder to explain", "Bigger and slower"],
        "tasks": ["classification"],
        "build": lambda seed: RandomForestClassifier(n_estimators=100, random_state=seed),
    },
    "decision_tree": {
        "label": "Decision Tree",
        "tagline": "A flowchart of ifs and elses",
        "how_it_thinks": (
            "Asks one question at a time: is the horsepower above 100? Split the rows "
            "by the answer, then keep asking until each pile is pure."
        ),
        "strengths": ["Very easy to read", "Handles mixed column types"],
        "weaknesses": ["Overfits easily", "A single split can ruin it"],
        "tasks": ["classification"],
        "build": lambda seed: DecisionTreeClassifier(random_state=seed),
    },
    "linear_regression": {
        "label": "Linear Regression",
        "tagline": "Draws a straight line through the points",
        "how_it_thinks": (
            "Gives every feature a weight and adds them up to get a number. Training "
            "slides the line up and down until the guesses are as close as possible "
            "to the real answers."
        ),
        "strengths": ["Very fast", "Weights are easy to read"],
        "weaknesses": ["Only straight-line patterns", "Sensitive to odd numbers"],
        "tasks": ["regression"],
        "build": lambda seed: LinearRegression(),
    },
    "ridge": {
        "label": "Ridge Regression",
        "tagline": "Linear regression with a brake",
        "how_it_thinks": (
            "Like linear regression, but it penalises large weights. That keeps the "
            "features from fighting each other when they say similar things."
        ),
        "strengths": ["Resists overfitting", "Handles correlated features"],
        "weaknesses": ["Still only straight lines", "Needs the penalty tuned"],
        "tasks": ["regression"],
        "build": lambda seed: Ridge(alpha=1.0, random_state=seed),
    },
    "knn_regressor": {
        "label": "K-Nearest Neighbors (numbers)",
        "tagline": "Averages the most similar rows",
        "how_it_thinks": (
            "Finds the 5 closest training rows and averages their answers. The idea "
            "is that a car priced like the neighbours is worth a similar amount."
        ),
        "strengths": ["Simple idea", "No training step"],
        "weaknesses": ["Slow on big data", "Needs scaled features"],
        "tasks": ["regression"],
        "build": lambda seed: KNeighborsRegressor(n_neighbors=5),
    },
    "random_forest_regressor": {
        "label": "Random Forest (numbers)",
        "tagline": "A crowd of trees averaging their guesses",
        "how_it_thinks": (
            "Grows 100 decision trees, each on a random sample, and averages their "
            "predicted numbers."
        ),
        "strengths": ["Strong default for numbers", "Handles odd relationships"],
        "weaknesses": ["Bigger and slower", "Harder to explain"],
        "tasks": ["regression"],
        "build": lambda seed: RandomForestRegressor(n_estimators=100, random_state=seed),
    },
    "decision_tree_regressor": {
        "label": "Decision Tree (numbers)",
        "tagline": "A flowchart that ends in a number",
        "how_it_thinks": (
            "Splits the rows by the question that separates them best, over and over, "
            "until each leaf holds rows with a similar value."
        ),
        "strengths": ["Easy to read", "Handles mixed column types"],
        "weaknesses": ["Overfits easily", "Choppy predictions"],
        "tasks": ["regression"],
        "build": lambda seed: DecisionTreeRegressor(random_state=seed),
    },
}

_PUBLIC_FIELDS = ("label", "tagline", "how_it_thinks",
                  "strengths", "weaknesses", "tasks")


def list_models(task: str | None = None) -> list[dict]:
    # The "build" lambda can't be sent as JSON, so we only expose the text fields
    models = [{"id": key, **{f: m[f] for f in _PUBLIC_FIELDS}} for key, m in MODELS.items()]
    if task:
        models = [m for m in models if task in m["tasks"]]
    return models


def build_model(model_id: str, seed: int):
    return MODELS[model_id]["build"](seed)


def models_for(task: str) -> list[dict]:
    """The models that make sense for a classification or regression task."""
    return list_models(task)


def supports_task(model_id: str, task: str) -> bool:
    entry = MODELS.get(model_id)
    if not entry:
        return False
    return task in entry["tasks"]
