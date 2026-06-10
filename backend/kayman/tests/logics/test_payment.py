import pytest

from kayman.logics.payment import validate_total
from kayman.schemas.payment import PaymentType
from kayman.tests.factories import PaymentFactory


def test_validate_total_expense():
    """Expense: Entries total is matched with transactions total"""
    details = PaymentFactory.build_details(
        type=PaymentType.Expense, entry_num=3, transaction_num=5
    )
    validate_total(details)


def test_validate_total_expense_multi_currencies():
    """Expense: Multiple currencies are used, validation should be skipped"""
    details = PaymentFactory.build_details(
        type=PaymentType.Expense, entry_num=3, transaction_num=5
    )
    details.entries[-1].currency_code += "_INVALID"  # explicitly change currency
    validate_total(details)


def test_validate_total_expense_mismatch():
    """Expense: Entries and transactions totals do not match"""
    details = PaymentFactory.build_details(
        type=PaymentType.Expense, entry_num=3, transaction_num=5
    )
    details.transactions[-1].amount += 1
    with pytest.raises(ValueError, match="transactions (.*) not match"):
        validate_total(details)


def test_validate_total_income():
    """Income: Entries total is matched with transactions total"""
    details = PaymentFactory.build_details(
        type=PaymentType.Income, entry_num=3, transaction_num=5
    )
    validate_total(details)


def test_validate_total_income_multi_currencies():
    """Income: Multiple currencies are used, validation should be skipped"""
    details = PaymentFactory.build_details(
        type=PaymentType.Income, entry_num=3, transaction_num=5
    )
    details.entries[-1].currency_code += "_INVALID"  # explicitly change currency
    validate_total(details)


def test_validate_total_income_mismatch():
    """Income: Entries and transactions totals do not match"""
    details = PaymentFactory.build_details(
        type=PaymentType.Income, entry_num=3, transaction_num=5
    )
    details.transactions[-1].amount += 1
    with pytest.raises(ValueError, match="transactions (.*) not match"):
        validate_total(details)


def test_validate_total_transfer():
    """Transfer: Validation should be skipped"""
    details = PaymentFactory.build_details(
        type=PaymentType.Transfer, entry_num=3, transaction_num=5
    )
    validate_total(details)


def test_validate_total_exchange():
    """Exchange: Validation should be skipped"""
    details = PaymentFactory.build_details(
        type=PaymentType.Exchange, entry_num=3, transaction_num=5
    )
    validate_total(details)
