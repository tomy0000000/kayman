from collections import defaultdict
from decimal import Decimal

import pytest
from sqlmodel import SQLModel

from kayman.mock_data import load_records
from kayman.schemas.account import Account
from kayman.schemas.currency import Currency
from kayman.schemas.transaction import Transaction


@pytest.mark.parametrize(
    "entity, schema",
    [
        ("currencies", Currency),
        ("accounts", Account),
        ("transactions", Transaction),
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


@pytest.mark.parametrize("entity", ["accounts"])
def test_record_ids_are_unique(entity: str) -> None:
    schema = {"accounts": Account}[entity]
    records = load_records(entity, schema)
    ids = [r.id for r in records]

    assert len(ids) == len(set(ids)), f"duplicate ids in {entity}.json"


def test_accounts_reference_known_currencies() -> None:
    currencies = load_records("currencies", Currency)
    accounts = load_records("accounts", Account)

    known_codes = {c.code for c in currencies}
    for account in accounts:
        assert account.currency_code in known_codes, (
            f"account id={account.id} {account.name!r} references "
            f"unknown currency_code {account.currency_code!r}"
        )


def test_transaction_totals_match_account_balances() -> None:
    """For every account, sum of seeded transactions must equal its balance."""
    accounts = load_records("accounts", Account)
    transactions = load_records("transactions", Transaction)

    actuals: dict[int, Decimal] = defaultdict(lambda: Decimal(0))
    for txn in transactions:
        actuals[txn.account_id] += txn.amount

    for account in accounts:
        assert account.id is not None
        assert actuals[account.id] == account.balance, (
            f"account id={account.id} {account.name!r}: txn total "
            f"{actuals[account.id]} != balance {account.balance}"
        )


def test_transactions_reference_known_accounts() -> None:
    accounts = {a.id for a in load_records("accounts", Account)}
    transactions = load_records("transactions", Transaction)

    for txn in transactions:
        assert txn.account_id in accounts, (
            f"transaction id={txn.id} references unknown account {txn.account_id}"
        )
