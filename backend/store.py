"""A tiny in-memory store: datasets, plus their prepared (preprocessed) versions."""

import uuid
from collections import OrderedDict

import pandas as pd
from fastapi import HTTPException

MAX_DATASETS = 20  # keep memory bounded: oldest datasets are dropped first
_store: "OrderedDict[str, dict]" = OrderedDict()
_prepared: dict[str, object] = {}


def save_dataset(df: pd.DataFrame, name: str) -> str:
    dataset_id = uuid.uuid4().hex[:12]
    _store[dataset_id] = {"df": df, "name": name}
    while len(_store) > MAX_DATASETS:
        old_id, _ = _store.popitem(last=False)
        _prepared.pop(old_id, None)
    return dataset_id


def get_dataset(dataset_id: str) -> dict:
    entry = _store.get(dataset_id)
    if entry is None:
        raise HTTPException(
            status_code=404, detail="Dataset not found. Please upload it again.")
    return entry


def save_prepared(dataset_id: str, prepared) -> None:
    _prepared[dataset_id] = prepared


def get_prepared(dataset_id: str):
    prepared = _prepared.get(dataset_id)
    if prepared is None:
        raise HTTPException(
            status_code=409, detail="Prepare this dataset first (Step 5).")
    return prepared
