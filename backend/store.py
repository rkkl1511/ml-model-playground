"""A tiny in-memory store: datasets, their prepared versions, and trained models."""

import uuid
from collections import OrderedDict

import pandas as pd
from fastapi import HTTPException

MAX_DATASETS = 20  # keep memory bounded: oldest datasets are dropped first
_store: "OrderedDict[str, dict]" = OrderedDict()
_prepared: dict[str, object] = {}
# dataset_id -> model_id -> trained bundle
_models: dict[str, dict[str, dict]] = {}


def save_dataset(df: pd.DataFrame, name: str) -> str:
    dataset_id = uuid.uuid4().hex[:12]
    _store[dataset_id] = {"df": df, "name": name}
    while len(_store) > MAX_DATASETS:
        old_id, _ = _store.popitem(last=False)
        _prepared.pop(old_id, None)
        _models.pop(old_id, None)
    return dataset_id


def get_dataset(dataset_id: str) -> dict:
    entry = _store.get(dataset_id)
    if entry is None:
        raise HTTPException(
            status_code=404, detail="Dataset not found. Please upload it again.")
    return entry


def save_prepared(dataset_id: str, prepared) -> None:
    _prepared[dataset_id] = prepared
    # Models trained on the old split are stale now, so forget them
    _models.pop(dataset_id, None)


def get_prepared(dataset_id: str):
    prepared = _prepared.get(dataset_id)
    if prepared is None:
        raise HTTPException(
            status_code=409, detail="Prepare this dataset first (Step 5).")
    return prepared


def save_model(dataset_id: str, model_id: str, bundle: dict) -> None:
    _models.setdefault(dataset_id, {})[model_id] = bundle


def get_model(dataset_id: str, model_id: str) -> dict:
    bundle = _models.get(dataset_id, {}).get(model_id)
    if bundle is None:
        raise HTTPException(
            status_code=409, detail="Train this model first (Step 6).")
    return bundle
