"""Work out what each column really contains, and clean it up accordingly.

This is the layer that fixes the classic failure: a column of "963 hp",
"$1,100,000" and "70-85 hp" that pandas calls "object" and a model would
then one-hot encode into a thousand useless columns.

The steps for one column:
  1. Work out whether it holds numbers (even with units attached) or labels.
  2. If it holds numbers, sort the units out: convert them to a common unit
     when they measure the same thing, and split the column when they don't.
  3. If it holds labels, fold together the spellings that differ only by
     case or spacing, and treat "-"/"N/A" as missing rather than as a class.
  4. Note down every decision, so the frontend can explain what happened.
"""

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from parsing import parse_column, suggest_extra_units
from textnorm import canonical_key, clean_text, group_variants, is_nullish
from units import BASE_UNIT, convert, unit_dimension

# Share of a column's non-blank cells that must parse as numbers before we
# call it a number column. Below this we would be inventing numbers.
NUMERIC_THRESHOLD = 0.8

# A second dimension has to be this common before we call the column mixed.
MIXED_SHARE = 0.1


@dataclass
class ColumnInfo:
    """What we learned about one column."""

    name: str
    kind: str = "categorical"      # "numeric" | "categorical" | "empty"
    parse_ratio: float = 0.0
    unit: str | None = None        # the unit the values are written in
    base_unit: str | None = None   # the unit they are converted to
    dimension: str | None = None   # what that unit measures
    units: dict = field(default_factory=dict)       # unit -> cells
    dimensions: dict = field(default_factory=dict)  # dimension -> cells
    mixed: bool = False
    split_columns: list = field(default_factory=list)
    variants: list = field(default_factory=list)
    nullish: int = 0               # cells that were "-", "N/A", ...
    unique: int = 0
    missing: int = 0
    notes: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "kind": self.kind,
            "parse_ratio": round(self.parse_ratio, 3),
            "unit": self.unit,
            "base_unit": self.base_unit,
            "dimension": self.dimension,
            "units": self.units,
            "dimensions": self.dimensions,
            "mixed": self.mixed,
            "split_columns": self.split_columns,
            "variants": self.variants,
            "nullish": self.nullish,
            "unique": self.unique,
            "missing": self.missing,
            "notes": self.notes,
        }


def infer_frame(df: pd.DataFrame) -> dict[str, ColumnInfo]:
    """Infer every column in a frame, once.

    The summary, the target suggestions and the preprocessing all need the
    same information, and parsing a column is not free, so we do it once.
    """
    return {str(column): infer_column(df[column]) for column in df.columns}


def infer_column(series: pd.Series) -> ColumnInfo:
    """Work out what a column holds without changing it."""
    name = str(series.name)
    info = ColumnInfo(name=name)
    values = series.tolist()

    info.missing = int(series.isna().sum())
    info.unique = int(series.nunique(dropna=True))

    non_blank = [v for v in values if not is_nullish(v)]
    if not non_blank:
        info.kind = "empty"
        return info

    cells, ratio = parse_column(values)
    extra = suggest_extra_units(cells)
    if extra:
        # "seats" was not in our unit table but every row ends with it.
        cells, ratio = parse_column(values, extra)
        if extra:
            info.notes.append({
                "level": "info",
                "title": "Unfamiliar unit found",
                "text": f"Every value in '{name}' ends with '{sorted(extra)[0]}', "
                        f"so we treated that as the unit.",
            })
    info.parse_ratio = ratio

    # A column pandas already knows is numeric needs none of this.
    if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
        info.kind = "numeric"
        info.dimension = None
        return info

    if ratio >= NUMERIC_THRESHOLD:
        info.kind = "numeric"
    else:
        info.kind = "categorical"

    # Count the units and dimensions we ran into, including compound cells.
    for cell in cells:
        if cell.blank:
            continue
        if cell.unit:
            info.units[cell.unit] = info.units.get(cell.unit, 0) + 1
        for dimension in cell.by_dimension:
            info.dimensions[dimension] = info.dimensions.get(dimension, 0) + 1

    real_dimensions = {d: c for d, c in info.dimensions.items() if d != "none"}
    if real_dimensions:
        dominant = max(real_dimensions, key=lambda d: real_dimensions[d])
        info.dimension = dominant
        info.base_unit = BASE_UNIT.get(dominant, "") or None
        # The unit the values are actually written in.
        for candidate in sorted(info.units, key=lambda u: -info.units[u]):
            if unit_dimension(candidate) == dominant:
                info.unit = candidate
                break
        total = sum(real_dimensions.values())
        others = {d: c for d, c in real_dimensions.items() if d != dominant}
        if others and max(others.values()) >= MIXED_SHARE * max(1, total):
            info.mixed = True
            info.split_columns = [
                {"name": f"{name} ({d})", "dimension": d,
                 "base_unit": BASE_UNIT.get(d, "")}
                for d in sorted(real_dimensions, key=lambda d: -real_dimensions[d])
            ]
            info.notes.append({
                "level": "warn",
                "title": "Mixed units in one column",
                "text": f"'{name}' holds "
                        f"{' and '.join(sorted(real_dimensions))} at the same time. "
                        f"They measure different things, so we split it into "
                        f"{len(real_dimensions)} separate columns instead of "
                        f"pretending they can be compared.",
            })

    if info.kind == "categorical":
        info.variants = group_variants(non_blank)
        info.nullish = sum(1 for v in values if is_nullish(v) and clean_text(v))
        if info.nullish:
            info.notes.append({
                "level": "info",
                "title": "Placeholder values treated as missing",
                "text": f"{info.nullish} cell(s) in '{name}' say '-', 'N/A' or similar. "
                        f"We treat those as gaps to fill, not as a real category.",
            })

    return info


def clean_numeric(series: pd.Series, info: ColumnInfo) -> tuple[pd.Series, list[dict]]:
    """Turn a number column into one clean float series, in a common unit.

    When the column mixes dimensions we return one series per dimension, so
    "1,600 cc / 13.8 kwh" becomes a cc column and a kWh column.
    """
    values = series.tolist()
    cells, _ = parse_column(values)
    extra = suggest_extra_units(cells)
    if extra:
        cells, _ = parse_column(values, extra)

    if info.mixed:
        out = []
        for split in info.split_columns:
            dimension = split["dimension"]
            numbers = []
            for cell in cells:
                value = cell.by_dimension.get(dimension)
                if value is None:
                    numbers.append(np.nan)
                    continue
                # "1.6 L" in a volume column becomes 1600 cc, so the two
                # halves of the split are on the same scale as each other.
                unit = cell.unit_by_dimension.get(dimension)
                numbers.append(convert(value, unit))
            out.append((split["name"], pd.Series(numbers, index=series.index,
                                                 dtype="float64")))
        return out, info.notes

    # One dimension: convert everything into the base unit of that dimension.
    base = BASE_UNIT.get(info.dimension or "", "")
    numbers = []
    for cell in cells:
        if not cell.numeric or cell.value is None:
            numbers.append(np.nan)
            continue
        value = cell.value
        if info.dimension and info.dimension != "currency":
            # "hp" becomes kW, "L" becomes cc, and so on.
            value = convert(value, cell.unit)
        numbers.append(value)

    cleaned = pd.Series(numbers, index=series.index, dtype="float64")
    if base and info.dimension and info.dimension != "currency":
        # The values are now in the base unit of their dimension.
        info.base_unit = base
    return [(info.name, cleaned)], info.notes


def clean_categorical(series: pd.Series, info: ColumnInfo) -> pd.Series:
    """Fold case variants together and treat placeholders as missing.

    "TOYOTA" and "Toyota" become one value; "-" and "N/A" become gaps the
    imputer can fill, rather than categories the model has to learn around.

    The rare-value grouping is NOT done here: it needs to know how often each
    value appears, and that has to be learned from the training rows only. It
    lives in the scikit-learn pipeline instead.
    """
    values = series.tolist()
    # Pick the display spelling for each canonical group.
    display: dict[str, str] = {}
    for raw in values:
        text = clean_text(raw)
        if not text or is_nullish(text):
            continue
        key = canonical_key(text)
        current = display.get(key)
        if current is None or (text.isupper() and not current.isupper()):
            display[key] = text

    cleaned = []
    for raw in values:
        text = clean_text(raw)
        if not text or is_nullish(text):
            cleaned.append(np.nan)
            continue
        cleaned.append(display.get(canonical_key(text), text))

    return pd.Series(cleaned, index=series.index, dtype="object")


def clean_frame(df: pd.DataFrame, target: str, drop_columns: list[str],
                high_cardinality: str = "group_rare",
                rare_threshold: int = 20,
                max_categories: int = 50) -> tuple[pd.DataFrame, list[ColumnInfo], list[dict]]:
    """Clean every feature column and return the new frame plus a report.

    The report is what the frontend shows: for each column, what we decided
    and why. Nothing is changed silently.
    """
    dropped = [c for c in drop_columns if c in df.columns]
    features = [c for c in df.columns if c != target and c not in dropped]

    cleaned = pd.DataFrame(index=df.index)
    infos: list[ColumnInfo] = []
    notes: list[dict] = []

    for name in features:
        info = infer_column(df[name])
        if info.kind == "empty":
            notes.append({
                "level": "info",
                "title": "Empty column skipped",
                "text": f"'{name}' had no values at all, so it was left out.",
            })
            continue

        if info.kind == "numeric":
            series_list, column_notes = clean_numeric(df[name], info)
            for new_name, series in series_list:
                cleaned[new_name] = series
        else:
            column_notes = info.notes
            if high_cardinality == "drop" and info.unique > max_categories:
                notes.append({
                    "level": "warn",
                    "title": "High-cardinality column dropped",
                    "text": f"'{name}' has {info.unique} different values, so one-hot "
                            f"encoding it would make {info.unique} almost-empty columns. "
                            f"You asked us to drop columns like this.",
                })
                infos.append(info)
                continue
            cleaned[info.name] = clean_categorical(df[name], info)

        infos.append(info)
        notes.extend(column_notes)

    return cleaned, infos, notes
