from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

from sqlmodel import Session

from kayman.crud.transaction import create_transactions, read_transactions
from kayman.schemas.transaction import Transaction, TransactionBase
from kayman.tests.factories import AccountFactory, EventFactory, TransactionFactory


def test_create_transactions_1_txn(session: Session):
    txn_create = EventFactory.build_details().transactions[0]
    txn = TransactionBase.model_validate(
        txn_create,
        update={
            "event_id": 1,
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
    assert db_txn.reconciled_at == txn.reconciled_at


def test_create_transactions_n_txn(session: Session):
    txn_creates = EventFactory.build_details(transaction_num=10).transactions
    txns = []
    for txn_index, txn_create in enumerate(txn_creates):
        txns.append(
            TransactionBase.model_validate(
                txn_create,
                update={
                    "event_id": 1,
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
        assert db_txn.reconciled_at == txn.reconciled_at


def test_create_transactions_no_commit(session: Session, session_2: Session):
    txn_create = EventFactory.build_details().transactions[0]
    txn = TransactionBase.model_validate(
        txn_create,
        update={
            "event_id": 1,
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
    assert session_txn.reconciled_at == txn.reconciled_at

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
    assert session_2_txn.reconciled_at == txn.reconciled_at


def test_read_transactions_all(session: Session):
    TransactionFactory.create_batch(10)

    assert len(read_transactions(session)) == 10


def test_read_transactions_by_id(session: Session):
    txn_1 = TransactionFactory()
    TransactionFactory()

    results = read_transactions(session, transaction_id=txn_1.id)

    assert len(results) == 1
    assert results[0].id == txn_1.id


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


def test_read_transactions_descending_without_order_by_is_unsorted(session: Session):
    account = AccountFactory()
    TransactionFactory.create_batch(3, account=account)

    results = read_transactions(session, account_id=account.id, descending=True)

    assert len(results) == 3


def test_read_transactions_for_update(session: Session):
    TransactionFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        read_transactions(session, for_update=True)
        args = mock_exec.call_args[0]
        statement = str(args[0])
        assert "FOR UPDATE" in statement
