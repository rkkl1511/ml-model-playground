"""Built-in sample datasets, so nobody has to upload a file to try things out.

Three of them come straight from scikit-learn. The fourth is a deliberately
messy used-car file: numbers written with units, prices with currency
symbols, Windows dashes, the same brand spelled three ways, a column that
leaks the target, and a cell that mixes cc with kWh. It is the dataset that
shows what this tool is actually for.
"""

import pandas as pd
from sklearn import datasets as skd

from fixtures import build_car_dataset

SAMPLES = {
    "iris": {
        "label": "Iris flowers",
        "description": "150 flowers · 4 measurements · 3 species",
        "loader": skd.load_iris,
        "target": "species",
    },
    "wine": {
        "label": "Wine recognition",
        "description": "178 wines · 13 chemical measurements · 3 cultivars",
        "loader": skd.load_wine,
        "target": "wine_class",
    },
    "breast_cancer": {
        "label": "Breast cancer",
        "description": "569 tumors · 30 measurements · benign vs malignant",
        "loader": skd.load_breast_cancer,
        "target": "diagnosis",
    },
    "car_market": {
        "label": "Used cars (messy)",
        "description": "420 listings · units in the text · a column that leaks",
        "loader": None,
        "target": "Price",
    },
}


def list_samples() -> list[dict]:
    # The loader function is not JSON-friendly, so we leave it out
    return [
        {"id": key, "label": m["label"],
            "description": m["description"], "target": m["target"]}
        for key, m in SAMPLES.items()
    ]


def build_sample(sample_id: str) -> pd.DataFrame:
    meta = SAMPLES[sample_id]
    if meta["loader"] is None:
        return build_car_dataset()
    bunch = meta["loader"](as_frame=True)
    df = bunch.data.copy()
    # Turn numeric labels (0, 1, 2) into readable names ("setosa", ...)
    df[meta["target"]] = bunch.target.map(lambda i: str(bunch.target_names[i]))
    return df
