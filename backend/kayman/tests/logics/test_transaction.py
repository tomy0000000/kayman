import re
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlmodel import Session

from kayman.crud.account import read_account
from kayman.logics.transaction import (
    _calculate_account_deltas,
    get_transactions_with_running_balance,
    update_transactions_with_balances,
    validate_transaction_clearable,
    validate_transactions_billable,
    validate_transactions_postable,
)
from kayman.schemas.transaction import (
    Transaction,
    TransactionBill,
    TransactionPost,
    TransactionStatusUpdate,
    TransactionUpdate,
)
from kayman.tests.factories import (
    AccountFactory,
    StatementFactory,
    TransactionFactory,
)


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


def test_validate_transactions_postable_passes(session: Session):
    txns = [TransactionFactory(posted_at=None, cleared_at=None) for _ in range(3)]

    assert (
        validate_transactions_postable(
            session,
            [
                TransactionPost(
                    transaction_id=t.id, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                )
                for t in txns
            ],
        )
        is None
    )


def test_validate_transactions_postable_empty(session: Session):
    with pytest.raises(ValueError, match=re.escape("No transactions to post")):
        validate_transactions_postable(session, [])


def test_validate_transactions_postable_duplicates(session: Session):
    txn_a = TransactionFactory(posted_at=None, cleared_at=None)
    txn_b = TransactionFactory(posted_at=None, cleared_at=None)

    with pytest.raises(
        ValueError,
        match=re.escape(f"Duplicate transaction id(s): {{{txn_a.id}}}"),
    ):
        validate_transactions_postable(
            session,
            [
                TransactionPost(
                    transaction_id=txn_a.id, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                ),
                TransactionPost(
                    transaction_id=txn_b.id, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                ),
                TransactionPost(
                    transaction_id=txn_a.id, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                ),
            ],
        )


def test_validate_transactions_postable_missing_ids(session: Session):
    txn = TransactionFactory(posted_at=None, cleared_at=None)

    with pytest.raises(
        ValueError, match=re.escape("Transaction id(s) not found: {998, 999}")
    ):
        validate_transactions_postable(
            session,
            [
                TransactionPost(
                    transaction_id=999, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                ),
                TransactionPost(
                    transaction_id=txn.id, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                ),
                TransactionPost(
                    transaction_id=998, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                ),
            ],
        )


def test_validate_transactions_postable_lists_all_not_pending(session: Session):
    statement = StatementFactory()
    account = statement.account
    pending = TransactionFactory(account=account, posted_at=None, cleared_at=None)
    posted = TransactionFactory(account=account, cleared_at=None)
    billed = TransactionFactory(
        account=account, statement_id=statement.id, posted_at=None, cleared_at=None
    )
    cleared = TransactionFactory(account=account, posted_at=None)

    with pytest.raises(
        ValueError,
        match=re.escape(
            f"Transaction id(s) not pending: {{{posted.id}, {billed.id}, {cleared.id}}}"
        ),
    ):
        validate_transactions_postable(
            session,
            [
                TransactionPost(
                    transaction_id=cleared.id,
                    posted_at=datetime(2025, 1, 1, tzinfo=UTC),
                ),
                TransactionPost(
                    transaction_id=pending.id,
                    posted_at=datetime(2025, 1, 1, tzinfo=UTC),
                ),
                TransactionPost(
                    transaction_id=billed.id, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                ),
                TransactionPost(
                    transaction_id=posted.id, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                ),
            ],
        )


def test_validate_transactions_postable_missing_before_not_pending(
    session: Session,
):
    posted = TransactionFactory(cleared_at=None)

    with pytest.raises(
        ValueError, match=re.escape("Transaction id(s) not found: {999}")
    ):
        validate_transactions_postable(
            session,
            [
                TransactionPost(
                    transaction_id=posted.id, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                ),
                TransactionPost(
                    transaction_id=999, posted_at=datetime(2025, 1, 1, tzinfo=UTC)
                ),
            ],
        )


def test_validate_transaction_clearable_passes(session: Session):
    statement = StatementFactory()
    txn = TransactionFactory(account=statement.account, statement_id=statement.id)

    assert validate_transaction_clearable(session, txn.id) is None


def test_validate_transaction_clearable_not_posted(session: Session):
    statement = StatementFactory()
    txn = TransactionFactory(
        account=statement.account, statement_id=statement.id, posted_at=None
    )

    with pytest.raises(ValueError, match="is not posted"):
        validate_transaction_clearable(session, txn.id)


def test_validate_transaction_clearable_no_statement(session: Session):
    txn = TransactionFactory()

    with pytest.raises(ValueError, match="not on a statement"):
        validate_transaction_clearable(session, txn.id)


def test_validate_transaction_clearable_no_event(session: Session):
    statement = StatementFactory()
    txn = TransactionFactory(
        account=statement.account,
        statement_id=statement.id,
        event=None,
        event_id=None,
    )

    with pytest.raises(ValueError, match="no associated event"):
        validate_transaction_clearable(session, txn.id)


def test_validate_transaction_clearable_missing_id(session: Session):
    with pytest.raises(ValueError, match="not found"):
        validate_transaction_clearable(session, 999)


def test_validate_transactions_billable_passes(session: Session):
    statement = StatementFactory()
    txns = [
        TransactionFactory(account=statement.account, cleared_at=None) for _ in range(3)
    ]

    assert (
        validate_transactions_billable(
            session,
            [
                TransactionBill(transaction_id=t.id, statement_id=statement.id)
                for t in txns
            ],
        )
        is None
    )


def test_validate_transactions_billable_passes_across_statements(session: Session):
    statement_a = StatementFactory()
    statement_b = StatementFactory()
    txn_a = TransactionFactory(account=statement_a.account, cleared_at=None)
    txn_b = TransactionFactory(account=statement_b.account, cleared_at=None)

    assert (
        validate_transactions_billable(
            session,
            [
                TransactionBill(transaction_id=txn_a.id, statement_id=statement_a.id),
                TransactionBill(transaction_id=txn_b.id, statement_id=statement_b.id),
            ],
        )
        is None
    )


def test_validate_transactions_billable_empty(session: Session):
    with pytest.raises(ValueError, match=re.escape("No transactions to bill")):
        validate_transactions_billable(session, [])


def test_validate_transactions_billable_duplicates(session: Session):
    statement = StatementFactory()
    txn_a = TransactionFactory(account=statement.account, cleared_at=None)
    txn_b = TransactionFactory(account=statement.account, cleared_at=None)

    with pytest.raises(
        ValueError,
        match=re.escape(f"Duplicate transaction id(s): {{{txn_a.id}}}"),
    ):
        validate_transactions_billable(
            session,
            [
                TransactionBill(transaction_id=txn_a.id, statement_id=statement.id),
                TransactionBill(transaction_id=txn_b.id, statement_id=statement.id),
                TransactionBill(transaction_id=txn_a.id, statement_id=statement.id),
            ],
        )


def test_validate_transactions_billable_missing_ids(session: Session):
    statement = StatementFactory()
    txn = TransactionFactory(account=statement.account, cleared_at=None)

    with pytest.raises(
        ValueError, match=re.escape("Transaction id(s) not found: {998, 999}")
    ):
        validate_transactions_billable(
            session,
            [
                TransactionBill(transaction_id=999, statement_id=statement.id),
                TransactionBill(transaction_id=txn.id, statement_id=statement.id),
                TransactionBill(transaction_id=998, statement_id=statement.id),
            ],
        )


@pytest.mark.parametrize("stage", ["PENDING", "BILLED", "CLEARED"])
def test_validate_transactions_billable_not_posted(session: Session, stage: str):
    statement = StatementFactory()
    overrides = {
        "PENDING": {"posted_at": None, "cleared_at": None},
        "BILLED": {"statement_id": statement.id, "cleared_at": None},
        "CLEARED": {},
    }[stage]
    txn = TransactionFactory(account=statement.account, **overrides)

    with pytest.raises(
        ValueError,
        match=re.escape(f"Transaction id(s) not posted: {{{txn.id}}}"),
    ):
        validate_transactions_billable(
            session, [TransactionBill(transaction_id=txn.id, statement_id=statement.id)]
        )


def test_validate_transactions_billable_lists_all_not_posted(session: Session):
    statement = StatementFactory()
    account = statement.account
    valid = TransactionFactory(account=account, cleared_at=None)
    pending = TransactionFactory(account=account, posted_at=None, cleared_at=None)
    billed = TransactionFactory(
        account=account, statement_id=statement.id, cleared_at=None
    )
    cleared = TransactionFactory(account=account)

    with pytest.raises(
        ValueError,
        match=re.escape(
            f"Transaction id(s) not posted: {{{pending.id}, {billed.id}, {cleared.id}}}"
        ),
    ):
        validate_transactions_billable(
            session,
            [
                TransactionBill(transaction_id=cleared.id, statement_id=statement.id),
                TransactionBill(transaction_id=valid.id, statement_id=statement.id),
                TransactionBill(transaction_id=billed.id, statement_id=statement.id),
                TransactionBill(transaction_id=pending.id, statement_id=statement.id),
            ],
        )


def test_validate_transactions_billable_missing_statements(session: Session):
    statement = StatementFactory()
    txns = [
        TransactionFactory(account=statement.account, cleared_at=None) for _ in range(3)
    ]

    with pytest.raises(
        ValueError, match=re.escape("Statement id(s) not found: {998, 999}")
    ):
        validate_transactions_billable(
            session,
            [
                TransactionBill(transaction_id=txns[0].id, statement_id=999),
                TransactionBill(transaction_id=txns[1].id, statement_id=statement.id),
                TransactionBill(transaction_id=txns[2].id, statement_id=998),
            ],
        )


def test_validate_transactions_billable_other_account(session: Session):
    statement = StatementFactory()
    same_1 = TransactionFactory(account=statement.account, cleared_at=None)
    same_2 = TransactionFactory(account=statement.account, cleared_at=None)
    other_1 = TransactionFactory(cleared_at=None)
    other_2 = TransactionFactory(cleared_at=None)

    with pytest.raises(
        ValueError,
        match=re.escape(
            "Statement does not belong to the account of "
            f"transaction id(s): {{{other_1.id}, {other_2.id}}}"
        ),
    ):
        validate_transactions_billable(
            session,
            [
                TransactionBill(transaction_id=other_2.id, statement_id=statement.id),
                TransactionBill(transaction_id=same_1.id, statement_id=statement.id),
                TransactionBill(transaction_id=other_1.id, statement_id=statement.id),
                TransactionBill(transaction_id=same_2.id, statement_id=statement.id),
            ],
        )


def test_validate_transactions_billable_duplicates_before_missing(session: Session):
    statement = StatementFactory()
    txn = TransactionFactory(account=statement.account, cleared_at=None)

    with pytest.raises(
        ValueError,
        match=re.escape(f"Duplicate transaction id(s): {{{txn.id}}}"),
    ):
        validate_transactions_billable(
            session,
            [
                TransactionBill(transaction_id=txn.id, statement_id=statement.id),
                TransactionBill(transaction_id=txn.id, statement_id=statement.id),
                TransactionBill(transaction_id=999, statement_id=statement.id),
            ],
        )


def test_validate_transactions_billable_missing_before_not_posted(session: Session):
    statement = StatementFactory()
    pending = TransactionFactory(
        account=statement.account, posted_at=None, cleared_at=None
    )

    with pytest.raises(
        ValueError, match=re.escape("Transaction id(s) not found: {999}")
    ):
        validate_transactions_billable(
            session,
            [
                TransactionBill(transaction_id=pending.id, statement_id=statement.id),
                TransactionBill(transaction_id=999, statement_id=statement.id),
            ],
        )


def test_validate_transactions_billable_not_posted_before_missing_statement(
    session: Session,
):
    pending = TransactionFactory(posted_at=None, cleared_at=None)

    with pytest.raises(
        ValueError,
        match=re.escape(f"Transaction id(s) not posted: {{{pending.id}}}"),
    ):
        validate_transactions_billable(
            session, [TransactionBill(transaction_id=pending.id, statement_id=999)]
        )


def test_update_transactions_with_balances_sets_statement(session: Session):
    txn = TransactionFactory(cleared_at=None)
    statement = StatementFactory(account=txn.account)

    updated = update_transactions_with_balances(
        session, [TransactionStatusUpdate(id=txn.id, statement_id=statement.id)]
    )

    assert updated[0].statement_id == statement.id


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
