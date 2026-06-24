from datetime import UTC, datetime
from decimal import Decimal

from sqlmodel import Session

from kayman.crud.transaction import create_transactions, get_transactions
from kayman.schemas.transaction import Transaction, TransactionBase
from kayman.tests.factories import AccountFactory, EventFactory, TransactionFactory


def test_create_transactions_1_txn(session: Session):
    txn_create = EventFactory.build_details().transactions[0]
    txn = TransactionBase.model_validate(
        txn_create,
        update={
            "payment_id": 1,
            "index": 0,
        },
    )
    db_txn = create_transactions(session, [txn])[0]

    assert db_txn.id is not None
    assert db_txn.account_id == txn.account_id
    assert db_txn.amount == txn.amount
    assert db_txn.description == txn.description
    assert db_txn.index == txn.index
    assert db_txn.payment_id == txn.payment_id
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
                    "payment_id": 1,
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
        assert db_txn.payment_id == txn.payment_id
        assert db_txn.created_at == txn.created_at
        assert db_txn.posted_at == txn.posted_at
        assert db_txn.reconciled_at == txn.reconciled_at


def test_create_transactions_no_commit(session: Session, session_2: Session):
    txn_create = EventFactory.build_details().transactions[0]
    txn = TransactionBase.model_validate(
        txn_create,
        update={
            "payment_id": 1,
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
    assert session_txn.payment_id == txn.payment_id
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
    assert session_2_txn.payment_id == txn.payment_id
    assert session_2_txn.created_at == txn.created_at
    assert session_2_txn.posted_at == txn.posted_at
    assert session_2_txn.reconciled_at == txn.reconciled_at


def test_get_transactions_all(session: Session):
    TransactionFactory.create_batch(10)

    assert len(get_transactions(session)) == 10


def test_get_transactions_by_account(session: Session):
    account_1 = AccountFactory()
    account_2 = AccountFactory()
    TransactionFactory(account=account_1)
    TransactionFactory(account=account_2)

    assert len(get_transactions(session, account_id=account_1.id)) == 1
    assert len(get_transactions(session, account_id=account_2.id)) == 1


def test_get_transactions_start_is_inclusive(session: Session):
    account = AccountFactory()
    start = datetime(2026, 1, 1, tzinfo=UTC)
    before_dt = datetime(2025, 12, 31, tzinfo=UTC)
    after_dt = datetime(2026, 2, 1, tzinfo=UTC)
    TransactionFactory(account=account, created_at=before_dt)
    on_start = TransactionFactory(account=account, created_at=start)
    after = TransactionFactory(account=account, created_at=after_dt)

    results = get_transactions(session, account_id=account.id, start=start)

    assert {txn.id for txn in results} == {on_start.id, after.id}


def test_get_transactions_end_is_exclusive(session: Session):
    account = AccountFactory()
    end = datetime(2026, 2, 1, tzinfo=UTC)
    before_dt = datetime(2026, 1, 15, tzinfo=UTC)
    after_dt = datetime(2026, 3, 1, tzinfo=UTC)
    before = TransactionFactory(account=account, created_at=before_dt)
    TransactionFactory(account=account, created_at=end)
    TransactionFactory(account=account, created_at=after_dt)

    results = get_transactions(session, account_id=account.id, end=end)

    assert {txn.id for txn in results} == {before.id}


def test_get_transactions_start_and_end_window(session: Session):
    account = AccountFactory()
    start = datetime(2026, 1, 1, tzinfo=UTC)
    end = datetime(2026, 2, 1, tzinfo=UTC)
    before_dt = datetime(2025, 12, 31, tzinfo=UTC)
    in_window_dt = datetime(2026, 1, 15, tzinfo=UTC)
    TransactionFactory(account=account, created_at=before_dt)
    in_window = TransactionFactory(account=account, created_at=in_window_dt)
    TransactionFactory(account=account, created_at=end)

    results = get_transactions(session, account_id=account.id, start=start, end=end)

    assert {txn.id for txn in results} == {in_window.id}


def test_get_transactions_order_by_created_at_ascending(session: Session):
    account = AccountFactory()
    d1 = datetime(2026, 1, 1, tzinfo=UTC)
    d2 = datetime(2026, 1, 2, tzinfo=UTC)
    d3 = datetime(2026, 1, 3, tzinfo=UTC)
    middle = TransactionFactory(account=account, created_at=d2)
    first = TransactionFactory(account=account, created_at=d1)
    last = TransactionFactory(account=account, created_at=d3)

    results = get_transactions(session, account_id=account.id, order_by="created_at")

    assert [txn.id for txn in results] == [first.id, middle.id, last.id]


def test_get_transactions_order_by_created_at_descending(session: Session):
    account = AccountFactory()
    d1 = datetime(2026, 1, 1, tzinfo=UTC)
    d2 = datetime(2026, 1, 2, tzinfo=UTC)
    d3 = datetime(2026, 1, 3, tzinfo=UTC)
    middle = TransactionFactory(account=account, created_at=d2)
    first = TransactionFactory(account=account, created_at=d1)
    last = TransactionFactory(account=account, created_at=d3)

    results = get_transactions(
        session, account_id=account.id, order_by="created_at", descending=True
    )

    assert [txn.id for txn in results] == [last.id, middle.id, first.id]


def test_get_transactions_order_by_amount(session: Session):
    account = AccountFactory()
    high = TransactionFactory(account=account, amount=Decimal("100"))
    low = TransactionFactory(account=account, amount=Decimal("-50"))
    mid = TransactionFactory(account=account, amount=Decimal("25"))

    results = get_transactions(session, account_id=account.id, order_by="amount")

    assert [txn.id for txn in results] == [low.id, mid.id, high.id]


def test_get_transactions_order_by_posted_at(session: Session):
    account = AccountFactory()
    d1 = datetime(2026, 1, 1, tzinfo=UTC)
    d2 = datetime(2026, 1, 2, tzinfo=UTC)
    d3 = datetime(2026, 1, 3, tzinfo=UTC)
    second = TransactionFactory(account=account, posted_at=d2)
    first = TransactionFactory(account=account, posted_at=d1)
    third = TransactionFactory(account=account, posted_at=d3)

    results = get_transactions(session, account_id=account.id, order_by="posted_at")

    assert [txn.id for txn in results] == [first.id, second.id, third.id]


def test_get_transactions_descending_without_order_by_is_unsorted(session: Session):
    account = AccountFactory()
    TransactionFactory.create_batch(3, account=account)

    results = get_transactions(session, account_id=account.id, descending=True)

    assert len(results) == 3
