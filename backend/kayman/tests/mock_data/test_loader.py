import pytest
from sqlmodel import SQLModel

from kayman.mock_data import load_records
from kayman.schemas.currency import Currency


@pytest.mark.parametrize(
    "entity, schema",
    [
        ("currencies", Currency),
    ],
)
def test_load_records(entity: str, schema: type[SQLModel]) -> None:
    records = load_records(entity, schema)

    assert len(records) > 0
    assert all(isinstance(r, schema) for r in records)


def test_load_currencies_includes_expected_codes() -> None:
    currencies = load_records("currencies", Currency)

    codes = {c.code for c in currencies}
    assert codes == {"EUR", "GBP", "HKD", "JPY", "SGD", "THB", "TWD", "USD", "VND"}


def test_currency_codes_are_unique() -> None:
    currencies = load_records("currencies", Currency)
    codes = [c.code for c in currencies]

    assert len(codes) == len(set(codes)), "duplicate currency codes in currencies.json"
