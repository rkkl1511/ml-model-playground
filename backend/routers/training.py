from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models import MODELS, list_models, supports_task
from store import get_dataset, get_prepared, save_model
from trainer import train_model

router = APIRouter(prefix="/api", tags=["training"])


class TrainRequest(BaseModel):
    model_id: str


@router.get("/models")
def get_models(task: str | None = None):
    """The catalogue of algorithms, optionally narrowed to one task."""
    if task and task not in ("classification", "regression"):
        raise HTTPException(status_code=400, detail=f"Unknown task: {task}")
    return list_models(task)


@router.post("/datasets/{dataset_id}/train")
def train(dataset_id: str, request: TrainRequest):
    get_dataset(dataset_id)                  # 404 if the dataset is gone
    prepared = get_prepared(dataset_id)      # 409 if Step 5 hasn't run
    if request.model_id not in MODELS:
        raise HTTPException(
            status_code=404, detail=f"Unknown model: {request.model_id}")
    if not supports_task(request.model_id, prepared.task):
        raise HTTPException(
            status_code=400,
            detail=(f"{MODELS[request.model_id]['label']} cannot do "
                    f"{prepared.task}. Pick a different algorithm."))

    try:
        bundle = train_model(request.model_id, prepared)
    except ValueError as err:
        raise HTTPException(
            status_code=400,
            detail=f"This model couldn't be trained on the current split: {err}") from err

    save_model(dataset_id, request.model_id, bundle)
    return bundle["result"]
