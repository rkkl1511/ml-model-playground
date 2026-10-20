"""Tests for the text clean-up layer."""

from textnorm import canonical_key, clean_text, group_variants, is_nullish


def test_windows_dashes_become_hyphens():
    # Every one of these is a different character that all look like a dash.
    for code in (0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212):
        assert clean_text(chr(code)) == "-"


def test_smart_quotes_become_plain_quotes():
    assert clean_text(chr(0x2019)) == "'"
    assert clean_text(chr(0x201C) + "x") == '"x'


def test_invisible_characters_are_removed():
    assert clean_text(chr(0x200B) + "a") == "a"
    assert clean_text(chr(0xFEFF) + "a") == "a"


def test_whitespace_is_collapsed():
    assert clean_text("  a   b  ") == "a b"


def test_case_differences_share_a_canonical_key():
    assert canonical_key("TOYOTA") == canonical_key("Toyota") == canonical_key("toyota")


def test_nullish_values_are_recognised():
    for text in ("", "-", "N/A", "n/a", "NULL", "unknown", "None", "?", "#N/A"):
        assert is_nullish(text) is True
    assert is_nullish("Toyota") is False
    assert is_nullish("0") is False


def test_variants_are_grouped_and_the_readable_one_wins():
    values = ["TOYOTA", "Toyota", "toyota", "Kia", "KIA"]
    groups = group_variants(values)
    assert len(groups) == 2

    toyota = next(g for g in groups if g["canonical"].lower() == "toyota")
    assert toyota["merged"] == 3
    # The all-caps spelling loses to the one that reads like a name.
    assert toyota["canonical"] == "Toyota"
    assert sum(v["count"] for v in toyota["variants"]) == 3


def test_a_column_with_no_variants_returns_nothing():
    assert group_variants(["a", "b", "c"]) == []
