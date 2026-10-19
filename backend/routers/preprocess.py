from fastapi import APIRouter, HTTPException

from preprocessing import PreprocessConfig, PreprocessError, prepare
from store import get_dataset, save_prepared

router = APIRouter(prefix="/api", tags=["preprocessing"])


@router.post("/datasets/{dataset_id}/preprocess")
def preprocess(dataset_id: str, config: PreprocessConfig):
    entry = get_dataset(dataset_id)
    try:
        prepared, summary = prepare(entry["df"], config)
    except PreprocessError as err:
        # The service raises plain Python errors; only the router knows about HTTP
        raise HTTPException(status_code=400, detail=str(err))
    save_prepared(dataset_id, prepared)
    summary["dataset_id"] = dataset_id
    return summary
