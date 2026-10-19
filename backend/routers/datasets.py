import io

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from profiling import build_profile
from samples import SAMPLES, build_sample, list_samples
from store import save_dataset, get_dataset
from summary import build_summary

router = APIRouter(prefix="/api", tags=["datasets"])

MAX_BYTES = 10 * 1024 * 1024  # 10 MB
MIN_ROWS = 10
MIN_COLUMNS = 2


def parse_csv(raw: bytes) -> pd.DataFrame:
    # utf-8-sig also handles the invisible BOM that Excel adds to CSV files
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            return pd.read_csv(io.BytesIO(raw), encoding=encoding)
        except UnicodeDecodeError:
            continue
        except pd.errors.EmptyDataError:
            raise HTTPException(status_code=400, detail="The file is empty.")
        except pd.errors.ParserError:
            raise HTTPException(
                status_code=400, detail="Could not parse the file as a CSV.")
    raise HTTPException(
        status_code=400, detail="Could not read the file's text encoding.")


@router.get("/samples")
def get_samples():
    return list_samples()


@router.post("/samples/{sample_id}")
def load_sample(sample_id: str):
    if sample_id not in SAMPLES:
        raise HTTPException(
            status_code=404, detail=f"Unknown sample dataset: {sample_id}")
    meta = SAMPLES[sample_id]
    df = build_sample(sample_id)
    dataset_id = save_dataset(df, meta["label"])
    return build_summary(dataset_id, meta["label"], df, suggested_target=meta["target"])


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(
            status_code=400, detail="Please upload a .csv file.")

    # Read one byte past the limit so we can tell "too big" without loading everything
    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(
            status_code=413, detail="File is too large (max 10 MB).")

    df = parse_csv(raw)
    df.columns = [str(c).strip() for c in df.columns]
    # Drop fully empty rows/columns (common leftovers from spreadsheet exports)
    df = df.dropna(how="all").dropna(axis=1, how="all")

    if df.shape[1] < MIN_COLUMNS:
        raise HTTPException(
            status_code=400, detail=f"Need at least {MIN_COLUMNS} columns.")
    if df.shape[0] < MIN_ROWS:
        raise HTTPException(
            status_code=400, detail=f"Need at least {MIN_ROWS} rows to train a model.")

    dataset_id = save_dataset(df, file.filename)
    return build_summary(dataset_id, file.filename, df)


@router.get("/datasets/{dataset_id}/profile")
def get_profile(dataset_id: str):
    entry = get_dataset(dataset_id)
    return build_profile(entry["df"])
