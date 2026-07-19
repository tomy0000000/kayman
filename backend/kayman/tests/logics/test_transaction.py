from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlmodel import Session

from kayman.crud.account import read_account
from kayman.logics.transaction import (
    _calculate_account_deltas,
    get_transactions_with_running_balance,
    update_transactions_with_balances,
    validate_transaction_has_event,
)
from kayman.schemas.transaction import Transaction, TransactionUpdate
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


def test_update_transactions_with_balances_moves_balance_by_delta(session: Session):
    account = AccountFactory(balance=Decimal("100.00"))
    txn = TransactionFactory(account=account, amount=Decimal("10.00"))

    updated = update_transactions_with_balances(
        session, [TransactionUpdate(id=txn.id, amount=Decimal("30.00"))]
    )

    assert len(updated) == 1
    assert updated[0].amount == Decimal("30.00")
    # delta = 30 - 10 = +20
    assert read_account(session, account.id).balance == Decimal("120.00")


def test_update_transactions_with_balances_reconciles_per_account(session: Session):
    account_a = AccountFactory(balance=Decimal("0.00"))
    account_b = AccountFactory(balance=Decimal("0.00"))
    txn_a = TransactionFactory(account=account_a, amount=Decimal("10.00"))
    txn_b = TransactionFactory(account=account_b, amount=Decimal("20.00"))

    # Ids out of insertion order: rows and prior amounts must stay aligned so
    # each account moves by its own delta.
    updated = update_transactions_with_balances(
        session,
        [
            TransactionUpdate(id=txn_b.id, amount=Decimal("50.00")),
            TransactionUpdate(id=txn_a.id, amount=Decimal("15.00")),
        ],
    )

    # Returned rows come back id-ordered regardless of the input order.
    assert [txn.id for txn in updated] == [txn_a.id, txn_b.id]
    assert read_account(session, account_a.id).balance == Decimal("5.00")  # 10 -> 15
    assert read_account(session, account_b.id).balance == Decimal("30.00")  # 20 -> 50


def test_update_transactions_with_balances_no_commit(
    session: Session, session_2: Session
):
    account = AccountFactory(balance=Decimal("0.00"))
    txn = TransactionFactory(account=account, amount=Decimal("10.00"))

    updated = update_transactions_with_balances(
        session, [TransactionUpdate(id=txn.id, amount=Decimal("40.00"))], commit=False
    )
    assert updated[0].amount == Decimal("40.00")

    # Not committed: other sessions still see the old amount.
    other = session_2.get(Transaction, txn.id)
    assert other.amount == Decimal("10.00")


def test_update_transactions_with_balances_aggregates_same_account(session: Session):
    account = AccountFactory(balance=Decimal("0.00"))
    txn_1 = TransactionFactory(account=account, amount=Decimal("10.00"))
    txn_2 = TransactionFactory(account=account, amount=Decimal("5.00"))

    # Two txns in one account, passed out of id order: the sort must realign
    # them with their rows so the balance moves by the sum of both deltas.
    updated = update_transactions_with_balances(
        session,
        [
            TransactionUpdate(id=txn_2.id, amount=Decimal("25.00")),
            TransactionUpdate(id=txn_1.id, amount=Decimal("15.00")),
        ],
    )

    assert [txn.id for txn in updated] == [txn_1.id, txn_2.id]
    # (15 - 10) + (25 - 5) = +25
    assert read_account(session, account.id).balance == Decimal("25.00")


def test_update_transactions_with_balances_does_not_mutate_input(session: Session):
    account = AccountFactory(balance=Decimal("0.00"))
    txn_1 = TransactionFactory(account=account, amount=Decimal("10.00"))
    txn_2 = TransactionFactory(account=account, amount=Decimal("5.00"))
    updates = [
        TransactionUpdate(id=txn_2.id, amount=Decimal("25.00")),
        TransactionUpdate(id=txn_1.id, amount=Decimal("15.00")),
    ]

    update_transactions_with_balances(session, updates)

    # The caller's list keeps its original order; sorting happens on a copy.
    assert [update.id for update in updates] == [txn_2.id, txn_1.id]


def test_validate_transaction_has_event_passes(session: Session):
    txn = TransactionFactory()

    assert validate_transaction_has_event(session, txn.id) is None


def test_validate_transaction_has_event_no_event(session: Session):
    txn = TransactionFactory(event=None, event_id=None)

    with pytest.raises(ValueError, match="no associated event"):
        validate_transaction_has_event(session, txn.id)


def test_validate_transaction_has_event_missing_id(session: Session):
    with pytest.raises(ValueError, match="not found"):
        validate_transaction_has_event(session, 999)


def test_update_transactions_with_balances_missing_id(session: Session):
    with pytest.raises(ValueError, match="not found"):
        update_transactions_with_balances(
            session, [TransactionUpdate(id=999, amount=Decimal("1.00"))]
        )


@pytest.mark.parametrize(
    ("transactions", "updates", "expected"),
    [
        # Single amount change: 10 -> 30 = +20.
        (
            [Transaction(account_id=1, amount=Decimal("10.00"))],
            [TransactionUpdate(id=1, amount=Decimal("30.00"))],
            {1: Decimal("20.00")},
        ),
        # Aggregated per account: a: (15-10)+(25-5)=+25, b: (50-20)=+30.
        (
            [
                Transaction(account_id=1, amount=Decimal("10.00")),
                Transaction(account_id=1, amount=Decimal("5.00")),
                Transaction(account_id=2, amount=Decimal("20.00")),
            ],
            [
                TransactionUpdate(id=1, amount=Decimal("15.00")),
                TransactionUpdate(id=2, amount=Decimal("25.00")),
                TransactionUpdate(id=3, amount=Decimal("50.00")),
            ],
            {1: Decimal("25.00"), 2: Decimal("30.00")},
        ),
        # Update without an amount leaves the balance untouched.
        (
            [Transaction(account_id=1, amount=Decimal("10.00"))],
            [TransactionUpdate(id=1, description="renamed")],
            {},
        ),
    ],
    ids=["single", "aggregates_per_account", "ignores_unchanged_amount"],
)
def test_calculate_account_deltas(transactions, updates, expected):
    assert _calculate_account_deltas(transactions, updates) == expected
