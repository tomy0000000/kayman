from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlmodel import Session

from kayman.crud.transaction import (
    create_transactions,
    read_transactions,
    update_transactions,
)
from kayman.schemas.transaction import (
    Transaction,
    TransactionBase,
    TransactionRead,
    TransactionUpdate,
)
from kayman.tests.factories import AccountFactory, EventFactory, TransactionFactory


def test_create_transactions_1_txn(session: Session):
    account = AccountFactory()
    event = EventFactory()
    txn_create = EventFactory.build_details().transactions[0]
    txn = TransactionBase.model_validate(
        txn_create,
        update={
            "account_id": account.id,
            "event_id": event.id,
            "index": 0,
        },
    )
    db_txn = create_transactions(session, [txn])[0]

    assert db_txn.id is not None
    assert db_txn.account_id == txn.account_id
    assert db_txn.amount == txn.amount
    assert db_txn.description == txn.description
    assert db_txn.index == txn.index
    assert db_txn.event_id == txn.event_id
    assert db_txn.created_at == txn.created_at
    assert db_txn.posted_at == txn.posted_at
    assert db_txn.cleared_at == txn.cleared_at


def test_create_transactions_n_txn(session: Session):
    account = AccountFactory()
    event = EventFactory()
    txn_creates = EventFactory.build_details(transaction_num=10).transactions
    txns = []
    for txn_index, txn_create in enumerate(txn_creates):
        txns.append(
            TransactionBase.model_validate(
                txn_create,
                update={
                    "account_id": account.id,
                    "event_id": event.id,
                    "index": txn_index,
                },
            )
        )
    db_txns = create_transactions(session, txns)

    assert len(db_txns) == 10
    for db_txn, txn in zip(db_txns, txns, strict=False):
        assert db_txn.id is not None
        assert db_txn.account_id == txn.account_id
        assert db_txn.amount == txn.amount
        assert db_txn.description == txn.description
        assert db_txn.index == txn.index
        assert db_txn.event_id == txn.event_id
        assert db_txn.created_at == txn.created_at
        assert db_txn.posted_at == txn.posted_at
        assert db_txn.cleared_at == txn.cleared_at


def test_create_transactions_no_commit(session: Session, session_2: Session):
    account = AccountFactory()
    event = EventFactory()
    txn_create = EventFactory.build_details().transactions[0]
    txn = TransactionBase.model_validate(
        txn_create,
        update={
            "account_id": account.id,
            "event_id": event.id,
            "index": 0,
        },
    )

    # The txn should be created in the session
    session_txn = create_transactions(session, [txn], commit=False)[0]
    assert session_txn.id is not None
    assert session_txn.account_id == txn.account_id
    assert session_txn.amount == txn.amount
    assert session_txn.description == txn.description
    assert session_txn.index == txn.index
    assert session_txn.event_id == txn.event_id
    assert session_txn.created_at == txn.created_at
    assert session_txn.posted_at == txn.posted_at
    assert session_txn.cleared_at == txn.cleared_at

    # The txn should not be visible to other sessions (yet)
    session_2_txn = session_2.get(Transaction, session_txn.id)
    assert session_2_txn is None

    # Commit the txn from main session
    session.commit()

    # The txn should now be visible to other sessions
    session_2_txn = session_2.get(Transaction, session_txn.id)
    assert session_2_txn.id is not None
    assert session_2_txn is not None
    assert session_2_txn.account_id == txn.account_id
    assert session_2_txn.amount == txn.amount
    assert session_2_txn.description == txn.description
    assert session_2_txn.index == txn.index
    assert session_2_txn.event_id == txn.event_id
    assert session_2_txn.created_at == txn.created_at
    assert session_2_txn.posted_at == txn.posted_at
    assert session_2_txn.cleared_at == txn.cleared_at


def test_read_transactions_all(session: Session):
    TransactionFactory.create_batch(10)

    assert len(read_transactions(session)) == 10


def test_read_transactions_expose_account_currency_code(session: Session):
    account = AccountFactory()
    TransactionFactory.create_batch(3, account=account)

    results = read_transactions(session, account_id=account.id)
    reads = [TransactionRead.model_validate(txn) for txn in results]

    assert len(reads) == 3
    assert all(read.currency_code == account.currency_code for read in reads)


def test_read_transactions_by_ids(session: Session):
    txn_1 = TransactionFactory()
    txn_2 = TransactionFactory()
    TransactionFactory()

    results = read_transactions(session, transaction_ids=[txn_1.id, txn_2.id])

    assert len(results) == 2
    assert {txn.id for txn in results} == {txn_1.id, txn_2.id}


def test_read_transactions_by_account(session: Session):
    account_1 = AccountFactory()
    account_2 = AccountFactory()
    TransactionFactory(account=account_1)
    TransactionFactory(account=account_2)

    assert len(read_transactions(session, account_id=account_1.id)) == 1
    assert len(read_transactions(session, account_id=account_2.id)) == 1


def test_read_transactions_by_event(session: Session):
    event_1 = EventFactory()
    event_2 = EventFactory()
    TransactionFactory(event=event_1)
    TransactionFactory(event=event_2)

    assert len(read_transactions(session, event_id=event_1.id)) == 1
    assert len(read_transactions(session, event_id=event_2.id)) == 1


def test_read_transactions_by_empty_event(session: Session):
    event = EventFactory()
    TransactionFactory(event=event)
    without_event = TransactionFactory(event=None, event_id=None)

    results = read_transactions(session, event_id="empty")

    assert len(results) == 1
    assert {txn.id for txn in results} == {without_event.id}


def test_read_transactions_start_is_inclusive(session: Session):
    account = AccountFactory()
    start = datetime(2026, 1, 1, tzinfo=UTC)
    before_dt = datetime(2025, 12, 31, tzinfo=UTC)
    after_dt = datetime(2026, 2, 1, tzinfo=UTC)
    TransactionFactory(account=account, created_at=before_dt)
    on_start = TransactionFactory(account=account, created_at=start)
    after = TransactionFactory(account=account, created_at=after_dt)

    results = read_transactions(session, account_id=account.id, start=start)

    assert {txn.id for txn in results} == {on_start.id, after.id}


def test_read_transactions_end_is_exclusive(session: Session):
    account = AccountFactory()
    end = datetime(2026, 2, 1, tzinfo=UTC)
    before_dt = datetime(2026, 1, 15, tzinfo=UTC)
    after_dt = datetime(2026, 3, 1, tzinfo=UTC)
    before = TransactionFactory(account=account, created_at=before_dt)
    TransactionFactory(account=account, created_at=end)
    TransactionFactory(account=account, created_at=after_dt)

    results = read_transactions(session, account_id=account.id, end=end)

    assert {txn.id for txn in results} == {before.id}


def test_read_transactions_start_and_end_window(session: Session):
    account = AccountFactory()
    start = datetime(2026, 1, 1, tzinfo=UTC)
    end = datetime(2026, 2, 1, tzinfo=UTC)
    before_dt = datetime(2025, 12, 31, tzinfo=UTC)
    in_window_dt = datetime(2026, 1, 15, tzinfo=UTC)
    TransactionFactory(account=account, created_at=before_dt)
    in_window = TransactionFactory(account=account, created_at=in_window_dt)
    TransactionFactory(account=account, created_at=end)

    results = read_transactions(session, account_id=account.id, start=start, end=end)

    assert {txn.id for txn in results} == {in_window.id}


def test_read_transactions_order_by_created_at_ascending(session: Session):
    account = AccountFactory()
    d1 = datetime(2026, 1, 1, tzinfo=UTC)
    d2 = datetime(2026, 1, 2, tzinfo=UTC)
    d3 = datetime(2026, 1, 3, tzinfo=UTC)
    middle = TransactionFactory(account=account, created_at=d2)
    first = TransactionFactory(account=account, created_at=d1)
    last = TransactionFactory(account=account, created_at=d3)

    results = read_transactions(session, account_id=account.id, order_by="created_at")

    assert [txn.id for txn in results] == [first.id, middle.id, last.id]


def test_read_transactions_order_by_created_at_descending(session: Session):
    account = AccountFactory()
    d1 = datetime(2026, 1, 1, tzinfo=UTC)
    d2 = datetime(2026, 1, 2, tzinfo=UTC)
    d3 = datetime(2026, 1, 3, tzinfo=UTC)
    middle = TransactionFactory(account=account, created_at=d2)
    first = TransactionFactory(account=account, created_at=d1)
    last = TransactionFactory(account=account, created_at=d3)

    results = read_transactions(
        session, account_id=account.id, order_by="created_at", descending=True
    )

    assert [txn.id for txn in results] == [last.id, middle.id, first.id]


def test_read_transactions_order_by_amount(session: Session):
    account = AccountFactory()
    high = TransactionFactory(account=account, amount=Decimal("100"))
    low = TransactionFactory(account=account, amount=Decimal("-50"))
    mid = TransactionFactory(account=account, amount=Decimal("25"))

    results = read_transactions(session, account_id=account.id, order_by="amount")

    assert [txn.id for txn in results] == [low.id, mid.id, high.id]


def test_read_transactions_order_by_posted_at(session: Session):
    account = AccountFactory()
    d1 = datetime(2026, 1, 1, tzinfo=UTC)
    d2 = datetime(2026, 1, 2, tzinfo=UTC)
    d3 = datetime(2026, 1, 3, tzinfo=UTC)
    second = TransactionFactory(account=account, posted_at=d2)
    first = TransactionFactory(account=account, posted_at=d1)
    third = TransactionFactory(account=account, posted_at=d3)

    results = read_transactions(session, account_id=account.id, order_by="posted_at")

    assert [txn.id for txn in results] == [first.id, second.id, third.id]


def test_read_transactions_without_order_by_defaults_to_id_ascending(session: Session):
    account = AccountFactory()
    first, second, third = TransactionFactory.create_batch(3, account=account)

    results = read_transactions(session, account_id=account.id)

    assert len(results) == 3
    assert [txn.id for txn in results] == [first.id, second.id, third.id]


def test_read_transactions_descending_without_order_by_is_id_descending(
    session: Session,
):
    account = AccountFactory()
    first, second, third = TransactionFactory.create_batch(3, account=account)

    results = read_transactions(session, account_id=account.id, descending=True)

    assert len(results) == 3
    assert [txn.id for txn in results] == [third.id, second.id, first.id]


def test_read_transactions_for_update(session: Session):
    TransactionFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        read_transactions(session, for_update=True)
        args = mock_exec.call_args[0]
        statement = str(args[0])
        assert "FOR UPDATE" in statement


def test_update_transactions(session: Session):
    txn = TransactionFactory(amount=Decimal("100.00"), description="old")

    updated = update_transactions(
        session,
        [txn],
        [TransactionUpdate(id=txn.id, amount=Decimal("150.00"), description="new")],
    )

    assert len(updated) == 1
    assert updated[0].id == txn.id
    assert updated[0].amount == Decimal("150.00")
    assert updated[0].description == "new"


def test_update_transactions_no_commit(session: Session, session_2: Session):
    txn = TransactionFactory(amount=Decimal("100.00"))

    updated = update_transactions(
        session,
        [txn],
        [TransactionUpdate(id=txn.id, amount=Decimal("200.00"))],
        commit=False,
    )
    assert updated[0].amount == Decimal("200.00")

    # Not yet visible to other sessions until commit.
    other = session_2.get(Transaction, txn.id)
    assert other.amount == Decimal("100.00")


def test_update_transactions_length_mismatch(session: Session):
    txn = TransactionFactory()

    with pytest.raises(ValueError, match="same length"):
        update_transactions(session, [txn], [])


@pytest.mark.parametrize(
    ("field", "make_value", "commit"),
    [
        # FK fields need a fresh row created at test time, hence a callable.
        ("account_id", lambda: AccountFactory().id, True),
        ("event_id", lambda: EventFactory().id, True),
        ("amount", lambda: Decimal("123.45"), True),
        ("description", lambda: "new description", True),
        ("index", lambda: 9999, True),
        # Datetime fields use commit=False: SQLite drops tzinfo on the
        # post-commit refresh, so keep the in-memory tz-aware value to compare.
        ("created_at", lambda: datetime(2026, 6, 1, tzinfo=UTC), False),
        ("posted_at", lambda: datetime(2026, 6, 2, tzinfo=UTC), False),
        ("cleared_at", lambda: datetime(2026, 6, 3, tzinfo=UTC), False),
    ],
    ids=[
        "account_id",
        "event_id",
        "amount",
        "description",
        "index",
        "created_at",
        "posted_at",
        "cleared_at",
    ],
)
def test_update_transaction_field(session: Session, field, make_value, commit):
    txn = TransactionFactory(amount=Decimal("100.00"))
    new_value = make_value()

    updated = update_transactions(
        session,
        [txn],
        [TransactionUpdate(id=txn.id, **{field: new_value})],
        commit=commit,
    )

    assert len(updated) == 1
    assert getattr(updated[0], field) == new_value


def test_update_transaction_explicit_none_clears_field(session: Session):
    # The factory sets posted_at and description to non-null values.
    txn = TransactionFactory(amount=Decimal("100.00"))
    original_description = txn.description
    assert txn.posted_at is not None

    # Passing posted_at=None explicitly marks it "set", so exclude_unset keeps it
    # and the column is cleared. description is omitted, so it stays untouched.
    updated = update_transactions(
        session,
        [txn],
        [TransactionUpdate(id=txn.id, posted_at=None)],
    )

    assert len(updated) == 1
    assert updated[0].posted_at is None
    assert updated[0].description == original_description
