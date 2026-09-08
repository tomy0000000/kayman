from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from kayman.crud.statement import create_statements, read_statements
from kayman.schemas.account import Account
from kayman.schemas.statement import Statement, StatementCreate
from kayman.tests.factories import AccountFactory, StatementFactory


def assert_statement_matches(actual: Statement, expected: StatementCreate) -> None:
    """Assert a persisted statement matches ``expected``."""
    # The id is server-assigned, so there is nothing on the input to match it to
    assert actual.id is not None
    assert actual.account_id == expected.account_id
    assert actual.period_start_on == expected.period_start_on
    assert actual.period_end_on == expected.period_end_on
    assert actual.balance == expected.balance
    assert actual.due_on == expected.due_on
    assert actual.created_on == expected.created_on


def test_create_statements_1_statement(session: Session, session_2: Session):
    account = AccountFactory()
    statement = StatementCreate.model_validate(
        StatementFactory.build(account_id=account.id)
    )
    db_statement = create_statements(session, [statement])[0]

    session_2_statement = session_2.get(Statement, db_statement.id)
    assert session_2_statement is not None
    assert_statement_matches(session_2_statement, statement)


def test_create_statements_n_statements(session: Session):
    account = AccountFactory()
    statements = [
        StatementCreate.model_validate(statement)
        for statement in StatementFactory.build_batch(3, account_id=account.id)
    ]
    db_statements = create_statements(session, statements)

    assert len(db_statements) == 3
    for db_statement, statement in zip(db_statements, statements, strict=True):
        assert_statement_matches(db_statement, statement)


def test_create_statements_empty(session: Session):
    assert create_statements(session, []) == []


def test_create_statements_no_commit(session: Session, session_2: Session):
    account = AccountFactory()
    statement = StatementCreate.model_validate(
        StatementFactory.build(account_id=account.id)
    )

    # The statement should be created in the session
    session_statement = create_statements(session, [statement], commit=False)[0]
    assert_statement_matches(session_statement, statement)

    # The statement should not be visible to other sessions (yet)
    assert session_2.get(Statement, session_statement.id) is None

    # Commit the statement from main session
    session.commit()

    # The statement should now be visible to other sessions
    session_2_statement = session_2.get(Statement, session_statement.id)
    assert session_2_statement is not None
    assert_statement_matches(session_2_statement, statement)


def test_create_statements_defaults_created_on_to_today(session: Session):
    account = AccountFactory()
    built = StatementFactory.build(account_id=account.id)
    statement = StatementCreate(
        account_id=account.id,
        period_start_on=built.period_start_on,
        period_end_on=built.period_end_on,
        balance=built.balance,
        due_on=built.due_on,
    )
    db_statement = create_statements(session, [statement])[0]

    assert db_statement.created_on == date.today()


def test_create_statements_preserves_supplied_created_on(session: Session):
    # created_on is client-supplied so an importer can backfill old statements
    account = AccountFactory()
    statement = StatementCreate.model_validate(
        StatementFactory.build(account_id=account.id, created_on=date(2020, 1, 15))
    )
    db_statement = create_statements(session, [statement])[0]

    assert db_statement.created_on == date(2020, 1, 15)


@pytest.mark.parametrize(
    "balance",
    [Decimal("0.00"), Decimal("1234.56"), Decimal("-987.65")],
    ids=["zero", "positive", "negative"],
)
def test_create_statements_balance_round_trips(
    session: Session, session_2: Session, balance: Decimal
):
    account = AccountFactory()
    statement = StatementCreate.model_validate(
        StatementFactory.build(account_id=account.id, balance=balance)
    )
    db_statement = create_statements(session, [statement])[0]

    assert db_statement.balance == balance

    session_2_statement = session_2.get(Statement, db_statement.id)
    assert session_2_statement is not None
    assert session_2_statement.balance == balance


def test_create_statements_rejects_inverted_period():
    with pytest.raises(ValidationError):
        StatementCreate(
            account_id=1,
            period_start_on=date(2026, 3, 1),
            period_end_on=date(2026, 1, 1),
            balance=Decimal("100.00"),
            due_on=date(2026, 4, 1),
        )


def test_create_statements_rejects_due_on_before_period_end():
    with pytest.raises(ValidationError):
        StatementCreate(
            account_id=1,
            period_start_on=date(2026, 1, 1),
            period_end_on=date(2026, 1, 31),
            balance=Decimal("100.00"),
            due_on=date(2026, 1, 15),
        )


def test_create_statements_inverted_period_violates_db_check(session: Session):
    # Table-class init skips Pydantic validation, so the DB CHECK is the only
    # thing left guarding the invariant
    account = AccountFactory()
    session.add(
        Statement(
            account_id=account.id,
            period_start_on=date(2026, 3, 1),
            period_end_on=date(2026, 1, 1),
            balance=Decimal("100.00"),
            due_on=date(2026, 4, 1),
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()

    session.rollback()


def test_create_statements_due_on_before_period_end_violates_db_check(session: Session):
    account = AccountFactory()
    session.add(
        Statement(
            account_id=account.id,
            period_start_on=date(2026, 1, 1),
            period_end_on=date(2026, 1, 31),
            balance=Decimal("100.00"),
            due_on=date(2026, 1, 15),
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()

    session.rollback()


def test_create_statements_account_not_found(session: Session):
    statement = StatementCreate.model_validate(
        StatementFactory.build(account_id=999999)
    )

    with pytest.raises(IntegrityError):
        create_statements(session, [statement])


def closing_on(account: Account, period_end_on: date, **kwargs) -> Statement:
    """Persist a statement on ``account`` whose cycle closes on ``period_end_on``."""
    return StatementFactory(
        account=account,
        period_start_on=period_end_on - timedelta(days=30),
        period_end_on=period_end_on,
        **kwargs,
    )


def test_read_statements_empty(session: Session):
    assert read_statements(session) == []


def test_read_statements_all(session: Session):
    account = AccountFactory()
    for month in range(1, 11):
        closing_on(account, date(2026, month, 28))

    assert len(read_statements(session)) == 10


def test_read_statements_by_ids(session: Session):
    account = AccountFactory()
    first = closing_on(account, date(2026, 1, 31))
    closing_on(account, date(2026, 2, 28))
    third = closing_on(account, date(2026, 3, 31))

    results = read_statements(session, statement_ids=[first.id, third.id])

    assert len(results) == 2
    assert {statement.id for statement in results} == {first.id, third.id}


def test_read_statements_empty_ids_returns_all(session: Session):
    # An empty collection is falsy, so the filter is skipped rather than
    # narrowing to nothing
    account = AccountFactory()
    closing_on(account, date(2026, 1, 31))
    closing_on(account, date(2026, 2, 28))

    assert len(read_statements(session, statement_ids=[])) == 2


def test_read_statements_by_account_id(session: Session):
    account = AccountFactory()
    other = AccountFactory()
    mine = closing_on(account, date(2026, 1, 31))
    closing_on(other, date(2026, 2, 28))

    results = read_statements(session, account_id=account.id)

    assert len(results) == 1
    assert results[0].id == mine.id


def issued_on(account: Account, created_on: date, **kwargs) -> Statement:
    """Persist a statement on ``account`` recorded on ``created_on``."""
    return StatementFactory(account=account, created_on=created_on, **kwargs)


def test_read_statements_start_is_inclusive(session: Session):
    account = AccountFactory()
    start = date(2026, 2, 1)
    issued_on(account, date(2026, 1, 15))
    on_start = issued_on(account, start)
    after = issued_on(account, date(2026, 3, 1))

    results = read_statements(session, start=start)

    assert len(results) == 2
    assert {statement.id for statement in results} == {on_start.id, after.id}


def test_read_statements_end_is_exclusive(session: Session):
    account = AccountFactory()
    end = date(2026, 3, 1)
    before = issued_on(account, date(2026, 1, 15))
    issued_on(account, end)
    issued_on(account, date(2026, 4, 1))

    results = read_statements(session, end=end)

    assert len(results) == 1
    assert results[0].id == before.id


def test_read_statements_start_and_end_window(session: Session):
    account = AccountFactory()
    start = date(2026, 2, 1)
    end = date(2026, 4, 1)
    issued_on(account, date(2026, 1, 15))
    in_window = issued_on(account, date(2026, 2, 20))
    issued_on(account, end)

    results = read_statements(session, start=start, end=end)

    assert len(results) == 1
    assert results[0].id == in_window.id


def test_read_statements_range_follows_created_on_not_the_cycle(session: Session):
    # A backfilled statement: its cycle closed and fell due months before the
    # row was recorded. The window tracks when the row was recorded, so the
    # cycle's own window misses it and the record's window finds it
    account = AccountFactory()
    statement = StatementFactory(
        account=account,
        period_start_on=date(2025, 11, 1),
        period_end_on=date(2025, 11, 30),
        due_on=date(2025, 12, 20),
        created_on=date(2026, 3, 5),
    )

    assert read_statements(session, start=date(2025, 11, 1), end=date(2026, 1, 1)) == []

    results = read_statements(session, start=date(2026, 3, 1), end=date(2026, 4, 1))

    assert len(results) == 1
    assert results[0].id == statement.id


def test_read_statements_without_order_by_defaults_to_period_end_on_ascending(
    session: Session,
):
    account = AccountFactory()
    middle = closing_on(account, date(2026, 2, 28))
    first = closing_on(account, date(2026, 1, 31))
    last = closing_on(account, date(2026, 3, 31))

    results = read_statements(session)

    assert len(results) == 3
    assert [statement.id for statement in results] == [first.id, middle.id, last.id]


def test_read_statements_descending_without_order_by_is_period_end_on_descending(
    session: Session,
):
    account = AccountFactory()
    middle = closing_on(account, date(2026, 2, 28))
    first = closing_on(account, date(2026, 1, 31))
    last = closing_on(account, date(2026, 3, 31))

    results = read_statements(session, descending=True)

    assert len(results) == 3
    assert [statement.id for statement in results] == [last.id, middle.id, first.id]


def make_orderable_statements(account: Account) -> list[Statement]:
    """Three statements whose columns disagree on ordering.

    Cycle dates and id ascend together, while created_on and balance ascend in
    a different order, so each ``order_by`` produces a distinguishable result.
    """
    return [
        StatementFactory(
            account=account,
            period_start_on=date(2026, 1, 1),
            period_end_on=date(2026, 1, 31),
            due_on=date(2026, 2, 20),
            created_on=date(2026, 3, 1),
            balance=Decimal("300.00"),
        ),
        StatementFactory(
            account=account,
            period_start_on=date(2026, 2, 1),
            period_end_on=date(2026, 2, 28),
            due_on=date(2026, 3, 20),
            created_on=date(2026, 1, 1),
            balance=Decimal("100.00"),
        ),
        StatementFactory(
            account=account,
            period_start_on=date(2026, 3, 1),
            period_end_on=date(2026, 3, 31),
            due_on=date(2026, 4, 20),
            created_on=date(2026, 2, 1),
            balance=Decimal("200.00"),
        ),
    ]


@pytest.mark.parametrize(
    ("order_by", "expected"),
    [
        ("period_start_on", [0, 1, 2]),
        ("period_end_on", [0, 1, 2]),
        ("due_on", [0, 1, 2]),
        ("created_on", [1, 2, 0]),
        ("balance", [1, 2, 0]),
        ("id", [0, 1, 2]),
    ],
)
def test_read_statements_order_by(session: Session, order_by: str, expected: list[int]):
    statements = make_orderable_statements(AccountFactory())

    results = read_statements(session, order_by=order_by)  # type: ignore[arg-type]

    assert len(results) == 3
    assert [statement.id for statement in results] == [
        statements[index].id for index in expected
    ]


def test_read_statements_order_by_balance_descending(session: Session):
    statements = make_orderable_statements(AccountFactory())

    results = read_statements(session, order_by="balance", descending=True)

    assert len(results) == 3
    assert [statement.id for statement in results] == [
        statements[0].id,
        statements[2].id,
        statements[1].id,
    ]


def test_read_statements_for_update(session: Session):
    closing_on(AccountFactory(), date(2026, 1, 31))

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        read_statements(session, for_update=True)
        args = mock_exec.call_args[0]
        statement = str(args[0])
        assert "FOR UPDATE" in statement
