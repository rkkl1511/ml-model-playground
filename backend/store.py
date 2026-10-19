"""A tiny in-memory dataset store.

Each upload gets a short id. Later steps (preprocessing, training) will use
that id to find the DataFrame again.
"""

import uuid
from collections import OrderedDict

import pandas as pd
from fastapi import HTTPException

MAX_DATASETS = 20  # keep memory bounded: oldest datasets are dropped first
_store: "OrderedDict[str, dict]" = OrderedDict()


def save_dataset(df: pd.DataFrame, name: str) -> str:
    dataset_id = uuid.uuid4().hex[:12]
    _store[dataset_id] = {"df": df, "name": name}
    while len(_store) > MAX_DATASETS:
        _store.popitem(last=False)
    return dataset_id


def get_dataset(dataset_id: str) -> dict:
    entry = _store.get(dataset_id)
    if entry is None:
        raise HTTPException(
            status_code=404, detail="Dataset not found. Please upload it again.")
    return entry
