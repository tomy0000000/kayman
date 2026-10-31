import re
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlalchemy import event as sa_event
from sqlmodel import Session

from kayman.crud.account import read_account
from kayman.logics.transaction import (
    _calculate_account_deltas,
    _require_transactions,
    get_transactions_with_running_balance,
    update_transactions_with_balances,
    validate_transactions_billable,
    validate_transactions_clearable,
    validate_transactions_editable,
    validate_transactions_postable,
)
from kayman.schemas.transaction import (
    Transaction,
    TransactionBill,
    TransactionClearErrorType,
    TransactionPost,
    TransactionStatusUpdate,
    TransactionUpdate,
)
from kayman.tests.factories import (
    AccountFactory,
    EventEntryFactory,
    EventFactory,
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


def test_get_transactions_with_running_balance_includes_event_details(
    session: Session,
):
    account = AccountFactory()
    other = AccountFactory()
    event = EventFactory()
    EventEntryFactory(event=event, description="Lunch", index=0)
    EventEntryFactory(event=event, description="Coffee", index=1)
    TransactionFactory(account=account, event=event, amount=Decimal("-10"), index=0)
    TransactionFactory(account=other, event=event, amount=Decimal("10"), index=1)

    results = get_transactions_with_running_balance(session, account.id)

    assert len(results) == 1
    assert results[0].event is not None
    assert len(results[0].event.entries) == 2
    assert [e.description for e in results[0].event.entries] == ["Lunch", "Coffee"]
    assert len(results[0].event.transactions) == 2
    assert [
        (t.account_id, t.amount, t.currency_code) for t in results[0].event.transactions
    ] == [
        (account.id, Decimal("-10"), account.currency_code),
        (other.id, Decimal("10"), other.currency_code),
    ]


def test_get_transactions_with_running_balance_eager_loads_event_details(
    session: Session,
):
    account = AccountFactory()
    for _ in range(3):
        event = EventFactory()
        EventEntryFactory(event=event)
        TransactionFactory(account=account, event=event)
        TransactionFactory(event=event)
    account_id = account.id
    session.expunge_all()
    statements: list[str] = []

    def record(_conn, _cursor, statement, *_args):
        statements.append(statement)

    engine = session.get_bind()
    sa_event.listen(engine, "before_cursor_execute", record)
    try:
        results = get_transactions_with_running_balance(session, account_id)
    finally:
        sa_event.remove(engine, "before_cursor_execute", record)

    assert len(results) == 3
    # One query per relationship level, however many rows: no lazy loads.
    assert len(statements) == 7


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


def test_require_transactions_keyed_in_id_order(session: Session):
    first, second, third = TransactionFactory.create_batch(3)

    txns = _require_transactions(session, [third.id, first.id, second.id], "clear")

    assert len(txns) == 3
    assert list(txns) == [first.id, second.id, third.id]


def test_require_transactions_does_not_lock_by_default(session: Session):
    txn = TransactionFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        _require_transactions(session, [txn.id], "clear")
        statement = str(mock_exec.call_args[0][0])
        assert "FOR UPDATE" not in statement


def test_require_transactions_for_update(session: Session):
    txn = TransactionFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        _require_transactions(session, [txn.id], "clear", for_update=True)
        statement = str(mock_exec.call_args[0][0])
        assert "FOR UPDATE" in statement


@pytest.mark.parametrize("verb", ["post", "bill", "clear"])
def test_require_transactions_empty_names_the_verb(session: Session, verb: str):
    with pytest.raises(ValueError, match=re.escape(f"No transactions to {verb}")):
        _require_transactions(session, [], verb)


def test_require_transactions_lists_all_duplicates(session: Session):
    first, second, third = TransactionFactory.create_batch(3)

    with pytest.raises(
        ValueError,
        match=re.escape(f"Duplicate transaction id(s): {{{first.id}, {second.id}}}"),
    ):
        _require_transactions(
            session, [second.id, first.id, third.id, first.id, second.id], "clear"
        )


def test_require_transactions_lists_all_missing(session: Session):
    txn = TransactionFactory()

    with pytest.raises(
        ValueError, match=re.escape("Transaction id(s) not found: {998, 999}")
    ):
        _require_transactions(session, [999, txn.id, 998], "clear")


def test_require_transactions_duplicates_before_missing(session: Session):
    with pytest.raises(
        ValueError, match=re.escape("Duplicate transaction id(s): {999}")
    ):
        _require_transactions(session, [999, 999], "clear")


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


def test_validate_transactions_clearable_passes(session: Session):
    statement = StatementFactory()
    txns = [
        TransactionFactory(
            account=statement.account, statement_id=statement.id, cleared_at=None
        )
        for _ in range(3)
    ]

    errors = validate_transactions_clearable(session, [t.id for t in txns])

    assert len(errors) == 3
    assert errors == {t.id: [] for t in txns}


def test_validate_transactions_clearable_for_update(session: Session):
    statement = StatementFactory()
    txn = TransactionFactory(
        account=statement.account, statement_id=statement.id, cleared_at=None
    )

    errors = validate_transactions_clearable(session, [txn.id], for_update=True)

    assert len(errors) == 1
    assert errors == {txn.id: []}


def test_validate_transactions_clearable_empty(session: Session):
    with pytest.raises(ValueError, match=re.escape("No transactions to clear")):
        validate_transactions_clearable(session, [])


def test_validate_transactions_clearable_duplicates(session: Session):
    statement = StatementFactory()
    txn = TransactionFactory(account=statement.account, statement_id=statement.id)

    with pytest.raises(
        ValueError, match=re.escape(f"Duplicate transaction id(s): {{{txn.id}}}")
    ):
        validate_transactions_clearable(session, [txn.id, txn.id])


def test_validate_transactions_clearable_missing_ids(session: Session):
    statement = StatementFactory()
    txn = TransactionFactory(account=statement.account, statement_id=statement.id)

    with pytest.raises(
        ValueError, match=re.escape("Transaction id(s) not found: {998, 999}")
    ):
        validate_transactions_clearable(session, [999, txn.id, 998])


def test_validate_transactions_clearable_collects_every_error(session: Session):
    txn = TransactionFactory(event=None, event_id=None, posted_at=None)

    errors = validate_transactions_clearable(session, [txn.id])

    assert len(errors) == 1
    assert len(errors[txn.id]) == 4
    assert [error.type for error in errors[txn.id]] == [
        TransactionClearErrorType.NOT_POSTED,
        TransactionClearErrorType.NO_STATEMENT,
        TransactionClearErrorType.NO_EVENT,
        TransactionClearErrorType.ALREADY_CLEARED,
    ]
    assert [error.msg for error in errors[txn.id]] == [
        f"Transaction {txn.id} is not posted",
        f"Transaction {txn.id} is not on a statement",
        f"Transaction {txn.id} has no associated event",
        f"Transaction {txn.id} is already cleared",
    ]


def test_validate_transactions_clearable_keys_errors_by_transaction(
    session: Session,
):
    statement = StatementFactory()
    account = statement.account
    valid = TransactionFactory(
        account=account, statement_id=statement.id, cleared_at=None
    )
    pending = TransactionFactory(
        account=account, statement_id=statement.id, posted_at=None, cleared_at=None
    )
    cleared = TransactionFactory(account=account, statement_id=statement.id)

    errors = validate_transactions_clearable(
        session, [cleared.id, valid.id, pending.id]
    )

    assert len(errors) == 3
    assert errors[valid.id] == []
    assert [error.type for error in errors[pending.id]] == [
        TransactionClearErrorType.NOT_POSTED
    ]
    assert [error.type for error in errors[cleared.id]] == [
        TransactionClearErrorType.ALREADY_CLEARED
    ]


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


def test_validate_transactions_editable_passes(session: Session):
    txn = TransactionFactory(cleared_at=None, event=EventFactory(cleared_at=None))
    target = EventFactory(cleared_at=None)

    assert (
        validate_transactions_editable(
            session, [TransactionUpdate(id=txn.id, event_id=target.id)]
        )
        is None
    )


def test_validate_transactions_editable_empty_ignores_other_txns(session: Session):
    # An empty list must not fall through to reading every transaction
    TransactionFactory()

    assert validate_transactions_editable(session, []) is None


def test_validate_transactions_editable_cleared(session: Session):
    txn = TransactionFactory()

    with pytest.raises(
        ValueError, match=re.escape(f"Transaction id(s) already cleared: {{{txn.id}}}")
    ):
        validate_transactions_editable(
            session, [TransactionUpdate(id=txn.id, description="edited")]
        )


def test_validate_transactions_editable_move_into_cleared_event(session: Session):
    txn = TransactionFactory(cleared_at=None, event=EventFactory(cleared_at=None))
    target = EventFactory()

    with pytest.raises(
        ValueError, match=re.escape(f"Event id(s) already cleared: {{{target.id}}}")
    ):
        validate_transactions_editable(
            session, [TransactionUpdate(id=txn.id, event_id=target.id)]
        )
