from datetime import UTC, datetime
from decimal import Decimal

from sqlmodel import Session

from kayman.logics.transaction import get_transactions_with_running_balance
from kayman.tests.factories import AccountFactory, TransactionFactory


def test_get_transactions_with_running_balance_empty(session: Session):
    account = AccountFactory()

    assert get_transactions_with_running_balance(session, account.id) == []


def test_get_transactions_with_running_balance_accumulates(session: Session):
    account = AccountFactory()
    TransactionFactory(
        account=account,
        amount=Decimal("10"),
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("-3"),
        created_at=datetime(2026, 1, 2, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("5.50"),
        created_at=datetime(2026, 1, 3, tzinfo=UTC),
    )

    results = get_transactions_with_running_balance(session, account.id)

    assert [r.running_balance for r in results] == [
        Decimal("10"),
        Decimal("7"),
        Decimal("12.50"),
    ]


def test_get_transactions_with_running_balance_ordered_by_created_at(session: Session):
    account = AccountFactory()
    TransactionFactory(
        account=account,
        amount=Decimal("3"),
        created_at=datetime(2026, 1, 3, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("1"),
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("2"),
        created_at=datetime(2026, 1, 2, tzinfo=UTC),
    )

    results = get_transactions_with_running_balance(session, account.id)

    assert [r.amount for r in results] == [Decimal("1"), Decimal("2"), Decimal("3")]
    assert [r.running_balance for r in results] == [
        Decimal("1"),
        Decimal("3"),
        Decimal("6"),
    ]


def test_get_transactions_with_running_balance_start_seeds_opening(session: Session):
    account = AccountFactory()
    TransactionFactory(
        account=account,
        amount=Decimal("100"),
        created_at=datetime(2025, 12, 1, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("20"),
        created_at=datetime(2026, 1, 5, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("-7"),
        created_at=datetime(2026, 1, 10, tzinfo=UTC),
    )

    results = get_transactions_with_running_balance(
        session, account.id, start=datetime(2026, 1, 1, tzinfo=UTC)
    )

    assert [r.amount for r in results] == [Decimal("20"), Decimal("-7")]
    assert [r.running_balance for r in results] == [Decimal("120"), Decimal("113")]


def test_get_transactions_with_running_balance_end_is_exclusive(session: Session):
    account = AccountFactory()
    end = datetime(2026, 2, 1, tzinfo=UTC)
    TransactionFactory(
        account=account,
        amount=Decimal("10"),
        created_at=datetime(2026, 1, 15, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("999"),
        created_at=end,
    )

    results = get_transactions_with_running_balance(session, account.id, end=end)

    assert [r.amount for r in results] == [Decimal("10")]
    assert [r.running_balance for r in results] == [Decimal("10")]


def test_get_transactions_with_running_balance_isolates_account(session: Session):
    account_a = AccountFactory()
    account_b = AccountFactory()
    TransactionFactory(
        account=account_a,
        amount=Decimal("10"),
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    TransactionFactory(
        account=account_b,
        amount=Decimal("999"),
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )

    results = get_transactions_with_running_balance(session, account_a.id)

    assert len(results) == 1
    assert results[0].account_id == account_a.id
    assert results[0].running_balance == Decimal("10")
