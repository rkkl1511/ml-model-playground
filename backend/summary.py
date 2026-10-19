"""Turn a DataFrame into a JSON-safe summary the frontend can display."""

import json

import pandas as pd
from pandas.api.types import is_bool_dtype, is_numeric_dtype

PREVIEW_ROWS = 10


def column_kind(series: pd.Series) -> str:
    if is_numeric_dtype(series) and not is_bool_dtype(series):
        return "numeric"
    return "categorical"


def build_summary(dataset_id: str, name: str, df: pd.DataFrame, suggested_target: str | None = None) -> dict:
    columns = [
        {
            "name": str(col),
            "dtype": str(df[col].dtype),
            "kind": column_kind(df[col]),
            "missing": int(df[col].isna().sum()),
            "unique": int(df[col].nunique()),
        }
        for col in df.columns
    ]
    # to_json converts NaN to null and numpy numbers to plain numbers,
    # which json.dumps alone would choke on
    preview = json.loads(df.head(PREVIEW_ROWS).to_json(orient="records"))

    return {
        "dataset_id": dataset_id,
        "name": name,
        "rows": int(len(df)),
        "columns": columns,
        "preview": preview,
        # Convention: the label column is usually last
        "suggested_target": suggested_target or str(df.columns[-1]),
    }
