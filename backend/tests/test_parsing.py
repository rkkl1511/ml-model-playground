"""Tests for reading numbers out of messy cells."""

import pytest

from parsing import parse_cell, parse_column, suggest_extra_units


@pytest.mark.parametrize("text,value,unit,dimension", [
    ("963 hp", 963.0, "hp", "power"),
    ("2.5 sec", 2.5, "sec", "time"),
    ("$1,100,000", 1100000.0, None, "currency"),
    ("Rs. 45,000", 45000.0, None, "currency"),
    ("USD 1200", 1200.0, None, "currency"),
    ("1,200 cc", 1200.0, "cc", "volume"),
    ("1.5L", 1.5, "l", "volume"),
    ("45%", 45.0, "%", "ratio"),
    ("2,000 kg", 2000.0, "kg", "mass"),
    ("7.2 kWh", 7.2, "kwh", "energy"),
    ("200 km", 200.0, "km", "length"),
])
def test_reads_a_number_with_its_unit(text, value, unit, dimension):
    cell = parse_cell(text)
    assert cell.numeric is True
    assert cell.value == pytest.approx(value)
    assert cell.unit == unit
    assert cell.dimension == dimension


@pytest.mark.parametrize("text,value", [
    ("70-85 hp", 77.5),          # a range: we keep the midpoint
    ("70 to 85 hp", 77.5),
    ("1,60", 1.6),               # comma as a decimal point
    ("1,60,000", 160000.0),      # Indian lakh grouping
    ("1,600,000", 1600000.0),
])
def test_reads_awkward_number_formats(text, value):
    cell = parse_cell(text)
    assert cell.numeric is True
    assert cell.value == pytest.approx(value)


def test_a_range_is_marked_as_a_range():
    cell = parse_cell("70-85 hp")
    assert cell.is_range is True
    assert cell.value == pytest.approx(77.5)


def test_a_name_with_a_number_stays_text():
    # "Model 3" has a number in it, but the number is part of a name.
    cell = parse_cell("Model 3")
    assert cell.numeric is False
    assert cell.value is None


def test_windows_dash_does_not_break_a_range():
    # The en dash in "2 - 6 seats" is not a hyphen.
    cell = parse_cell("2 \u2013 6 seats", extra_units={"seats"})
    assert cell.numeric is True
    assert cell.value == pytest.approx(4.0)


def test_a_cell_with_two_measurements_keeps_both():
    cell = parse_cell("1,600 cc / 13.8 kwh")
    assert cell.numeric is False
    assert cell.by_dimension["volume"] == pytest.approx(1600.0)
    assert cell.by_dimension["energy"] == pytest.approx(13.8)


def test_a_shared_unknown_unit_is_accepted():
    values = ["6 seats", "7 seats", "5 seats", "4 seats"]
    cells, ratio = parse_column(values)
    assert ratio == 0.0

    extra = suggest_extra_units(cells)
    assert extra == {"seats"}

    cells, ratio = parse_column(values, extra)
    assert ratio == 1.0
    assert [c.value for c in cells] == [6.0, 7.0, 5.0, 4.0]


def test_a_stray_word_does_not_turn_text_into_numbers():
    cells, ratio = parse_column(["Model 3", "Series X", "Type 9"])
    assert ratio == 0.0
    assert suggest_extra_units(cells) == set()


def test_placeholders_are_not_numbers():
    for text in ("N/A", "-", "unknown", "None", "null", ""):
        assert parse_cell(text).numeric is False


def test_currency_words_do_not_match_inside_other_words():
    # "4 doors" contains "rs", but it is not a rupee amount.
    cell = parse_cell("4 doors")
    assert cell.currency is None
    assert cell.numeric is False
