"""Turn a DataFrame into a JSON-safe summary the frontend can display.

The summary is not just a list of column names. For each column we say what
we think it really contains, because "Mileage" holding "20.5 km/l" is a
number column even though pandas calls it text, and the user should be able
to see that before they choose a target.
"""

import json

import pandas as pd
from pandas.api.types import is_bool_dtype, is_numeric_dtype

from infer import infer_frame
from target import suggest_targets

PREVIEW_ROWS = 10


def column_kind(series: pd.Series) -> str:
    """What pandas thinks the column is, without looking inside it."""
    if is_numeric_dtype(series) and not is_bool_dtype(series):
        return "numeric"
    return "categorical"


def build_summary(dataset_id: str, name: str, df: pd.DataFrame,
                  suggested_target: str | None = None) -> dict:
    infos = infer_frame(df)

    columns = []
    for col in df.columns:
        info = infos[str(col)]
        columns.append({
            "name": str(col),
            "dtype": str(df[col].dtype),
            # "kind" is what we believe after looking inside the column.
            "kind": info.kind,
            # "raw_kind" is what pandas believes from the dtype alone.
            "raw_kind": column_kind(df[col]),
            "parse_ratio": round(info.parse_ratio, 2),
            "unit": info.unit,
            "dimension": info.dimension,
            "mixed_units": info.mixed,
            "missing": int(df[col].isna().sum()),
            "unique": int(df[col].nunique()),
        })

    # to_json converts NaN to null and numpy numbers to plain numbers,
    # which json.dumps alone would choke on
    preview = json.loads(df.head(PREVIEW_ROWS).to_json(orient="records"))

    suggestions = suggest_targets(df, infos)
    default_target = suggested_target
    if not default_target:
        default_target = suggestions[0]["name"] if suggestions else str(df.columns[-1])

    return {
        "dataset_id": dataset_id,
        "name": name,
        "rows": int(len(df)),
        "columns": columns,
        "preview": preview,
        "suggested_target": default_target,
        "target_suggestions": suggestions,
    }
