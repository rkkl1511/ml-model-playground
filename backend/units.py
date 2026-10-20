"""A small unit table, so "1,600 cc" and "1.6 L" can become the same number.

Without this, a column that mixes units gets one-hot encoded into hundreds of
useless columns: every spelling of a volume becomes its own category and the
model has to learn "cc" and "L" are the same thing from scratch, using data
it does not have.

Each entry maps a unit to the dimension it measures and the factor that turns it
into that dimension's base unit. Units we cannot compare (currencies) get their
own dimension so they are never silently converted into each other.
"""

# dimension -> the unit we convert everything else into
BASE_UNIT = {
    "power": "kW",
    "volume": "cc",
    "length": "m",
    "mass": "kg",
    "energy": "kWh",
    "time": "s",
    "voltage": "V",
    "speed": "rpm",
    "torque": "Nm",
    "consumption": "km/l",
    "currency": "",          # money never converts without a market rate
    "ratio": "%",
    "count": "",             # "5 seats", "4 doors": dimensionless
}

# unit -> (dimension, factor to the base unit)
UNITS: dict[str, tuple[str, float]] = {
    # Power
    "hp": ("power", 0.7457), "bhp": ("power", 0.7457),
    "kw": ("power", 1.0), "ps": ("power", 0.7355),
    # Volume
    "cc": ("volume", 1.0), "cm3": ("volume", 1.0), "cm^3": ("volume", 1.0),
    "ml": ("volume", 1.0), "l": ("volume", 1000.0), "litre": ("volume", 1000.0),
    "liter": ("volume", 1000.0), "ltr": ("volume", 1000.0),
    # Length
    "mm": ("length", 0.001), "cm": ("length", 0.01),
    "m": ("length", 1.0), "km": ("length", 1000.0),
    "in": ("length", 0.0254), "inch": ("length", 0.0254),
    "inches": ("length", 0.0254), "ft": ("length", 0.3048),
    "feet": ("length", 0.3048), "foot": ("length", 0.3048),
    "mile": ("length", 1609.34), "miles": ("length", 1609.34),
    # Mass
    "mg": ("mass", 0.000001), "g": ("mass", 0.001),
    "kg": ("mass", 1.0), "kgs": ("mass", 1.0),
    "lb": ("mass", 0.453592), "lbs": ("mass", 0.453592),
    "pound": ("mass", 0.453592), "oz": ("mass", 0.0283495),
    # Energy
    "wh": ("energy", 0.001), "kwh": ("energy", 1.0),
    "mwh": ("energy", 1000.0),
    # Time
    "ms": ("time", 0.001), "s": ("time", 1.0), "sec": ("time", 1.0),
    "secs": ("time", 1.0), "second": ("time", 1.0), "seconds": ("time", 1.0),
    "min": ("time", 60.0), "mins": ("time", 60.0), "minute": ("time", 60.0),
    "minutes": ("time", 60.0), "h": ("time", 3600.0), "hr": ("time", 3600.0),
    "hour": ("time", 3600.0), "hours": ("time", 3600.0),
    # Voltage
    "v": ("voltage", 1.0), "volt": ("voltage", 1.0), "volts": ("voltage", 1.0),
    # Rotational speed and a few other everyday car specs
    "rpm": ("speed", 1.0),
    # Torque
    "nm": ("torque", 1.0), "n-m": ("torque", 1.0), "newton-metre": ("torque", 1.0),
    "kgm": ("torque", 9.80665),
    # Fuel consumption
    "km/l": ("consumption", 1.0), "kmpl": ("consumption", 1.0),
    # Percentage and plain counts
    "%": ("ratio", 1.0), "percent": ("ratio", 1.0),
    "pct": ("ratio", 1.0),
}

# Money is handled separately: we strip the symbol and remember which one it
# was, but we never convert between currencies.
#
# Symbols are matched anywhere in the cell. Words like "rs" are only matched
# as whole tokens, otherwise "4 doors" would be read as a rupee amount.
CURRENCY_SYMBOLS = {
    chr(0x24): "USD",   # $
    chr(0x20AC): "EUR",  # euro sign
    chr(0xA3): "GBP",   # pound sign
    chr(0x20B9): "INR",  # rupee sign
    chr(0xA5): "JPY",   # yen sign
    chr(0x20A9): "KRW",  # won sign
    chr(0x20BD): "RUB",  # rouble sign
    chr(0x20BA): "TRY",  # lira sign
    chr(0x20A6): "NGN",  # naira sign
}

# Text forms of the same idea, so "USD 1,100" works as well as "$1,100".
CURRENCY_WORDS = {
    "usd": "USD", "eur": "EUR", "gbp": "GBP", "inr": "INR",
    "jpy": "JPY", "krw": "KRW", "rub": "RUB", "aud": "AUD",
    "cad": "CAD", "brl": "BRL", "rs": "INR", "rs.": "INR",
}


def unit_dimension(unit: str | None) -> str | None:
    """The dimension a unit measures, or None if we don't recognise it."""
    if not unit:
        return None
    entry = UNITS.get(unit.strip().lower())
    return entry[0] if entry else None


def convert(value: float, unit: str | None, target: str | None = None) -> float:
    """Convert a value from one unit to the base unit of its dimension.

    Returns the value unchanged when the unit is unknown, when the dimension
    is currency, or when the conversion would be meaningless. We would rather
    keep a number as-is than mangle it.
    """
    if not unit:
        return value
    entry = UNITS.get(unit.strip().lower())
    if not entry:
        return value
    dimension, factor = entry
    if dimension == "currency":
        return value
    return value * factor


def base_unit(dimension: str | None) -> str:
    """The unit a dimension is stored in."""
    return BASE_UNIT.get(dimension or "", "")


def describe_conversion(units: list[str]) -> list[dict]:
    """Explain how a set of units gets merged into one number column.

    For "cc" and "L" it says both are volume and that L becomes cc. For "cc"
    and "kWh" it says they measure different things, so the column has to be
    split rather than converted.
    """
    by_dimension: dict[str, set[str]] = {}
    for unit in units:
        dimension = unit_dimension(unit)
        if dimension:
            by_dimension.setdefault(dimension, set()).add(unit.lower())

    out = []
    for dimension, members in by_dimension.items():
        base = base_unit(dimension)
        out.append({
            "dimension": dimension,
            "units": sorted(members),
            "base_unit": base,
            "convertible": len(members) == 1 or dimension != "currency",
        })
    return out
