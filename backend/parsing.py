"""Pull real numbers out of messy cells.

Real files write numbers the way people talk: "963 hp", "$1,100,000",
"2.5 sec", "70-85 hp", or "1,600 cc / 13.8 kwh". Treated as text, a column
like that becomes a category with thousands of spellings, and one-hot
encoding turns it into thousands of useless columns. Parsed properly,
"1,600 cc" and "1.6 L" both become 1600 and the column becomes a single
useful number.

The parser is deliberately conservative: a cell only counts as a number when
the text around the number is a unit we recognise. "Model 3" stays text,
because the number there is part of a name, not a measurement.
"""

import re
from dataclasses import dataclass, field

from textnorm import clean_text
from units import CURRENCY_SYMBOLS, CURRENCY_WORDS, unit_dimension

# A numeric run: digits with optional thousands separators, or a decimal.
_NUMBER = r"[-+]?\d[\d,\u00a0\u2009 ]*(?:\.\d+)?|[-+]?\.\d+"
_NUMBER_RE = re.compile(_NUMBER)

# "70-85 hp" or "6 – 7 seats": two numbers with a dash between them.
_RANGE_RE = re.compile(
    r"(?<![\w.])"
    r"([-+]?\d[\d,\u00a0 ]*\.?\d*)"
    r"\s*(?:-|\bto\b)\s*"
    r"([-+]?\d[\d,\u00a0 ]*\.?\d*)"
    r"\s*([a-zA-Z%]{1,15})?",
    re.IGNORECASE,
)

# The word right after a number: the unit, if there is one. A unit is a word
# or a percent sign, never a stray dash or bracket.
_TAIL_RE = re.compile(r"^[\s]*([A-Za-z%°/]{1,24})")

# Currency words written out ("USD 1,100", "1,100 USD", "Rs. 1,100").
_CURRENCY_WORD_RE = re.compile(
    r"(?<![\w])(usd|eur|gbp|inr|jpy|krw|rub|aud|cad|brl|rs\.?|inr\.?)(?![\w])",
    re.IGNORECASE,
)

# Four-digit numbers that look like years are not a numeric range.
_YEAR_LO, _YEAR_HI = 1900, 2100


@dataclass
class Cell:
    """What we found in one cell."""

    value: float | None = None          # the number to use, if there is one
    unit: str | None = None             # the unit it was measured in
    dimension: str | None = None        # what the unit measures
    numbers: list[float] = field(default_factory=list)
    is_range: bool = False              # the cell held "70-85"
    currency: str | None = None         # "$" -> "USD"
    extra_token: str | None = None      # a trailing word we don't know yet
    numeric: bool = False               # did we accept this cell as a number?
    blank: bool = False                 # was the cell empty to begin with?
    by_dimension: dict = field(default_factory=dict)      # dimension -> number
    unit_by_dimension: dict = field(default_factory=dict)  # dimension -> unit


def _to_float(raw: str) -> float | None:
    """Turn a numeric run into a float, guessing the separator style.

    "1,600" is one thousand six hundred, "1,60" is one point six (comma as a
    decimal point) and "1,60,000" is one lakh sixty thousand. We decide by
    looking at the length of the groups after the first comma.
    """
    text = raw.strip().replace("\u00a0", "").replace("\u2009", "").replace(" ", "")
    if not text:
        return None

    sign = 1.0
    if text[0] in "+-":
        if text[0] == "-":
            sign = -1.0
        text = text[1:]
    if not text:
        return None

    if "," in text:
        parts = text.split(",")
        head, tail = parts[0], parts[1:]
        if tail and all(len(p) == 3 for p in tail):
            text = head + "".join(tail)                       # 1,600,000
        elif len(tail) >= 2 and len(tail[-1]) == 3 and all(len(p) == 2 for p in tail[:-1]):
            text = head + "".join(tail)                       # 1,60,000 (Indian)
        elif len(tail) == 1 and len(tail[0]) in (1, 2):
            text = head + "." + tail[0]                       # 1,60 (decimal comma)
        else:
            text = head + "".join(tail)

    try:
        return sign * float(text)
    except ValueError:
        return None


def _find_currency(text: str) -> tuple[str | None, str]:
    """Find a currency marker and remove it from the text.

    Returns the currency code (or None) and the text with the marker taken
    out, so the number scanner doesn't trip over it.
    """
    word = _CURRENCY_WORD_RE.search(text)
    if word:
        code = CURRENCY_WORDS.get(word.group(1).lower().rstrip("."))
        if code:
            return code, (text[:word.start()] + " " + text[word.end():]).strip()

    for symbol, code in CURRENCY_SYMBOLS.items():
        if symbol in text:
            return code, text.replace(symbol, " ")
    return None, text


def _replace_ranges(text: str) -> tuple[str, list[tuple[float, float, str | None]]]:
    """Fold "70-85 hp" into its midpoint, and remember it was a range.

    Ranges are not errors, but they lose information: a car with "70-85 hp"
    is not the same as one with 77.5 hp. We keep the midpoint for training
    and report the range so the user knows.
    """
    found: list[tuple[float, float, str | None]] = []

    def repl(match: re.Match) -> str:
        lo = _to_float(match.group(1))
        hi = _to_float(match.group(2))
        unit = (match.group(3) or "").lower() or None
        if lo is None or hi is None:
            return match.group(0)
        # A pair of years is a label, not a range.
        if float(lo).is_integer() and float(hi).is_integer():
            if _YEAR_LO <= lo <= _YEAR_HI and _YEAR_LO <= hi <= _YEAR_HI:
                return match.group(0)
        # A huge jump means these were two separate numbers.
        if lo != 0 and hi != 0 and abs(hi / lo) > 10:
            return match.group(0)
        found.append((lo, hi, unit))
        midpoint = (lo + hi) / 2
        return f"{midpoint:g} {unit}" if unit else f"{midpoint:g}"

    return _RANGE_RE.sub(repl, text), found


def parse_cell(value, extra_units=frozenset()) -> Cell:
    """Read one cell and work out what number (if any) it holds.

    "extra_units" lets the column-level pass say "we also accept the word
    'seats' as a unit" once it has seen that every row uses it.
    """
    text = clean_text(value)
    cell = Cell()
    if not text:
        return cell

    currency, text = _find_currency(text)
    cell.currency = currency

    text, ranges = _replace_ranges(text)
    if ranges:
        cell.is_range = True

    matches = list(_NUMBER_RE.finditer(text))
    if not matches:
        return cell

    pieces: list[tuple[float, str, str]] = []  # (number, prefix, tail)
    for match in matches:
        number = _to_float(match.group(0))
        if number is None:
            continue
        prefix = text[:match.start()].strip()
        tail_match = _TAIL_RE.match(text[match.end():])
        tail = tail_match.group(1) if tail_match else ""
        pieces.append((number, prefix, tail))

    if not pieces:
        return cell

    cell.numbers = [p[0] for p in pieces]

    # Work out which tail token belongs to which number.
    for number, _prefix, tail in pieces:
        unit = tail.lower() if tail else None
        dimension = unit_dimension(unit)
        if unit and dimension is None and unit not in extra_units and unit not in CURRENCY_WORDS:
            # An unknown word: maybe it is a unit we will accept later.
            cell.extra_token = unit
            continue
        if unit and unit in CURRENCY_WORDS:
            cell.currency = CURRENCY_WORDS[unit]
            unit = None
            dimension = "currency"
        if dimension is None and not unit:
            dimension = "currency" if currency else None
        if dimension:
            cell.by_dimension.setdefault(dimension, number)
            cell.unit_by_dimension.setdefault(dimension, unit)

    # A single number is only accepted when the words around it are units we
    # understand. "Model 3" has a number but it is part of a name.
    if len(pieces) == 1:
        number, prefix, tail = pieces[0]
        if prefix and not _is_currency_marker(prefix, currency):
            return cell
        if tail:
            unit = tail.lower()
            if unit not in extra_units and unit_dimension(unit) is None and unit not in CURRENCY_WORDS:
                cell.extra_token = unit
                return cell
        cell.value = number
        cell.numeric = True
        cell.unit = tail.lower() if tail else None
        cell.dimension = unit_dimension(cell.unit) or ("currency" if currency else None)
        return cell

    # Several numbers in one cell: "1,600 cc / 13.8 kwh". If they measure
    # different things, the cell has to be split into separate columns.
    dimensions = set(cell.by_dimension)
    if len(dimensions) > 1:
        cell.value = None
        cell.numeric = False
        return cell
    if not dimensions:
        # Several numbers and no unit to tell us what they are: "2020-2021"
        # or "2 5". We cannot honestly call that a measurement.
        cell.value = None
        cell.numeric = False
        return cell

    first = pieces[0]
    cell.value = first[0]
    cell.numeric = True
    cell.unit = first[2].lower() if first[2] else None
    cell.dimension = unit_dimension(cell.unit)
    return cell


def _is_currency_marker(prefix: str, currency: str | None) -> bool:
    """True when the text before a number is just a currency marker."""
    if not prefix:
        return True
    cleaned = prefix.strip().lower().rstrip(".")
    if cleaned in CURRENCY_WORDS or cleaned in ("rs", "inr", "usd", "eur", "gbp"):
        return True
    return bool(currency) and all(c in "$€£₹¥₩₽₺₦" for c in prefix.strip())


def parse_column(values, extra_units=frozenset()) -> tuple[list[Cell], float]:
    """Parse every cell in a column and report how many we understood.

    The return value is the share of non-blank cells that became numbers.
    Blank cells are excluded from the count, so a sparse column is not
    punished for being sparse.
    """
    cells = []
    for raw in values:
        cell = parse_cell(raw, extra_units)
        cell.blank = not clean_text(raw)
        cells.append(cell)

    filled = [c for c in cells if not c.blank]
    if not filled:
        return cells, 0.0
    # A cell counts as understood if it gave us a number, or if it held
    # several measurements we could still tell apart ("1,600 cc / 13.8 kwh").
    understood = sum(1 for c in filled if c.numeric or c.by_dimension)
    return cells, understood / len(filled)


def suggest_extra_units(cells: list[Cell]) -> set[str]:
    """Find a trailing word that most cells share, and treat it as a unit.

    "6 seats", "7 seats", "5 seats": we don't have "seats" in the unit table,
    but if nearly every cell ends with the same word, it clearly is one. We
    only accept it if it dominates, so a stray word never turns text into
    numbers.
    """
    tokens: dict[str, int] = {}
    total = 0
    for cell in cells:
        if cell.extra_token:
            tokens[cell.extra_token] = tokens.get(cell.extra_token, 0) + 1
            total += 1
    if not tokens:
        return set()
    token, count = max(tokens.items(), key=lambda item: item[1])
    if count >= max(3, 0.5 * total):
        return {token}
    return set()
