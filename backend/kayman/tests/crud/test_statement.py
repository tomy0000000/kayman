from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from kayman.crud.statement import create_statements
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
