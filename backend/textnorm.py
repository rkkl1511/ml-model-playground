"""Text clean-up that runs before anything else looks at a cell.

Real CSVs are written by people and spreadsheets, not by programs. They carry
Windows dashes, smart quotes, invisible spaces and inconsistent capitalisation.
Every one of those turns two identical values into two different categories,
which quietly wrecks a model: "TOYOTA" and "Toyota" become two classes, and
the model learns from each of them as if they were different manufacturers.

The character tables below are built from code points rather than typed in
directly, so this file stays pure ASCII. A source file that contains invisible
characters by accident is a bug waiting to happen.
"""

import re
import unicodedata

# Dashes that look like a hyphen but are not one. A file with "6 - 7 seats"
# written by a word processor uses U+2013; if we keep it, the number parser
# never matches and the column stays text.
_DASH_CODES = (
    0x2010,  # hyphen
    0x2011,  # non-breaking hyphen
    0x2012,  # figure dash
    0x2013,  # en dash
    0x2014,  # em dash
    0x2015,  # horizontal bar
    0x2212,  # minus sign
    0xFE58,  # small em dash
    0xFE63,  # small hyphen-minus
    0xFF0D,  # fullwidth hyphen-minus
)
_DASHES = {code: "-" for code in _DASH_CODES}

# Smart quotes and primes, so "Maruti's" doesn't become its own category.
_SINGLE_QUOTE_CODES = (0x2018, 0x2019, 0x201A, 0x201B, 0x2032, 0x2035)
_DOUBLE_QUOTE_CODES = (0x201C, 0x201D, 0x201E, 0x2033, 0x00AB, 0x00BB)
_QUOTES = {code: "'" for code in _SINGLE_QUOTE_CODES}
_QUOTES.update({code: '"' for code in _DOUBLE_QUOTE_CODES})

# Invisible characters: zero-width space and friends, plus soft hyphen and the
# various space characters a spreadsheet can leave behind.
_INVISIBLE_CODES = (
    0x200B,  # zero width space
    0x200C,  # zero width non-joiner
    0x200D,  # zero width joiner
    0x2060,  # word joiner
    0xFEFF,  # zero width no-break space (BOM)
    0x00AD,  # soft hyphen
    0x2007,  # figure space
    0x202F,  # narrow no-break space
    0x2008,  # punctuation space
    0x2009,  # thin space
    0x3000,  # ideographic space
)
_INVISIBLE = dict.fromkeys(_INVISIBLE_CODES, None)

# str.translate() looks up ORDINALS, not characters. A mapping keyed by
# "chr(0x2013)" is silently ignored on Python 3.14+, which is exactly the
# kind of bug that makes a feature look like it does nothing. Ordinal keys
# work on every version, so we use those.
_TRANSLATION = {**_DASHES, **_QUOTES, **_INVISIBLE}

_MULTISPACE = re.compile(r"\s+")

# Cells that mean "no value" rather than "a short value".
_NULLISH = {"", "-", "--", "?", "n/a", "na", "nan", "none", "null", "nil",
            "unknown", "not available", "not applicable", "#n/a", "#na!",
            "not known", "undefined"}


def clean_text(value) -> str:
    """Normalise one cell into plain, comparable text.

    The steps, in order: unicode compatibility form (turns ligatures and
    full-width characters into normal ones), then our dash and quote table,
    then whitespace collapsing. Returns "" for anything missing so callers
    can treat "absent" and "blank" the same way.
    """
    if value is None:
        return ""
    if isinstance(value, float) and value != value:  # NaN
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    text = text.translate(_TRANSLATION)
    text = _MULTISPACE.sub(" ", text)
    return text.strip()


def is_nullish(value) -> bool:
    """True when a cell is really "no value", not just a short string.

    "-" and "N/A" are the two most common ways spreadsheets say "I don't know".
    Treating them as real categories adds a junk class the model then has to
    learn around.
    """
    text = clean_text(value).casefold()
    if not text:
        return True
    return text in _NULLISH


def canonical_key(value) -> str:
    """The key two cells must share to count as the same category.

    Case is ignored on purpose. "TOYOTA", "Toyota" and "toyota" are the same
    company, and a model that treats them as three classes learns nothing from
    two of them.
    """
    return clean_text(value).casefold()


def looks_shouty(value: str) -> bool:
    """True for "TOYOTA" but not "Toyota" or "toyota".

    Used to pick a readable display spelling for a merged group of variants.
    """
    letters = [c for c in value if c.isalpha()]
    if len(letters) < 2:
        return False
    return all(c.isupper() for c in letters)


def group_variants(values) -> list[dict]:
    """Group values that differ only by case, spacing or punctuation.

    Returns one entry per canonical group, biggest first, each listing the
    spellings that were merged and how many rows each had. The frontend shows
    this so the user can see exactly what was folded together and object.
    """
    groups: dict[str, dict] = {}
    for raw in values:
        text = clean_text(raw)
        if not text:
            continue
        key = canonical_key(text)
        group = groups.setdefault(key, {"canonical": text, "variants": {}})
        group["variants"][text] = group["variants"].get(text, 0) + 1

    out = []
    for group in groups.values():
        variants = group["variants"]
        if len(variants) < 2:
            continue
        # Prefer a spelling that isn't all caps, then the most common one.
        best = sorted(
            variants.items(),
            key=lambda item: (looks_shouty(item[0]), -item[1]),
        )[0][0]
        out.append({
            "canonical": best,
            "variants": [
                {"value": name, "count": count}
                for name, count in sorted(variants.items(), key=lambda i: -i[1])
            ],
            "merged": len(variants),
        })
    out.sort(key=lambda g: (-g["merged"], g["canonical"].lower()))
    return out
