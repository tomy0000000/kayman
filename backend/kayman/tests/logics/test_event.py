import pytest

from kayman.logics.event import validate_total
from kayman.schemas.event import EventType
from kayman.tests.factories import EventFactory


def test_validate_total_expense():
    """Expense: Entries total is matched with transactions total"""
    details = EventFactory.build_details(
        type=EventType.Expense, entry_num=3, transaction_num=5
    )
    validate_total(details)


def test_validate_total_expense_multi_currencies():
    """Expense: Multiple currencies are used, validation should be skipped"""
    details = EventFactory.build_details(
        type=EventType.Expense, entry_num=3, transaction_num=5
    )
    details.entries[-1].currency_code += "_INVALID"  # explicitly change currency
    validate_total(details)


def test_validate_total_expense_mismatch():
    """Expense: Entries and transactions totals do not match"""
    details = EventFactory.build_details(
        type=EventType.Expense, entry_num=3, transaction_num=5
    )
    details.transactions[-1].amount += 1
    with pytest.raises(ValueError, match="transactions (.*) not match"):
        validate_total(details)


def test_validate_total_income():
    """Income: Entries total is matched with transactions total"""
    details = EventFactory.build_details(
        type=EventType.Income, entry_num=3, transaction_num=5
    )
    validate_total(details)


def test_validate_total_income_multi_currencies():
    """Income: Multiple currencies are used, validation should be skipped"""
    details = EventFactory.build_details(
        type=EventType.Income, entry_num=3, transaction_num=5
    )
    details.entries[-1].currency_code += "_INVALID"  # explicitly change currency
    validate_total(details)


def test_validate_total_income_mismatch():
    """Income: Entries and transactions totals do not match"""
    details = EventFactory.build_details(
        type=EventType.Income, entry_num=3, transaction_num=5
    )
    details.transactions[-1].amount += 1
    with pytest.raises(ValueError, match="transactions (.*) not match"):
        validate_total(details)


def test_validate_total_transfer():
    """Transfer: Validation should be skipped"""
    details = EventFactory.build_details(
        type=EventType.Transfer, entry_num=3, transaction_num=5
    )
    validate_total(details)


def test_validate_total_exchange():
    """Exchange: Validation should be skipped"""
    details = EventFactory.build_details(
        type=EventType.Exchange, entry_num=3, transaction_num=5
    )
    validate_total(details)
