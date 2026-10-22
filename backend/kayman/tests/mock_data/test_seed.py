import re
from collections.abc import Callable

from loguru import logger
from sqlmodel import Session, select

from kayman.logics.event import validate_event_clearable
from kayman.mock_data.seed import seed
from kayman.schemas.account import Account
from kayman.schemas.category import Category
from kayman.schemas.currency import Currency
from kayman.schemas.event import Event, EventClearErrorType
from kayman.schemas.statement import Statement
from kayman.schemas.transaction import (
    Transaction,
    TransactionRead,
    TransactionStatus,
)
from kayman.schemas.transaction_tag import TransactionTag, TransactionTagLink

LABEL_PATTERN = re.compile(r"^\[(?P<labels>[^\]]+)\] ")


def _labels(description: str | None) -> list[str]:
    """Split a `[role, role] text` description into its roles."""
    match = LABEL_PATTERN.match(description or "")
    return match["labels"].split(", ") if match else []


def _clear_error_types(event: Event) -> set[EventClearErrorType]:
    return {error.type for error in validate_event_clearable(event)}


def _status(transaction: Transaction) -> TransactionStatus:
    return TransactionRead.model_validate(transaction).status


EVENT_LABEL_CHECKS: dict[str, Callable[[Event], bool]] = {
    "clearable": lambda e: not _clear_error_types(e),
    "not clearable: totals mismatch": lambda e: (
        EventClearErrorType.TOTALS_MISMATCH in _clear_error_types(e)
    ),
    "not clearable: not cleared": lambda e: (
        EventClearErrorType.TRANSACTIONS_NOT_CLEARED in _clear_error_types(e)
    ),
    "deletable": lambda e: not e.transactions,
    "multi-entry": lambda e: len(e.entries) > 1,
    "multi-txn": lambda e: len(e.transactions) > 1,
}

TRANSACTION_LABEL_CHECKS: dict[str, Callable[[Transaction], bool]] = {
    "pending": lambda t: _status(t) is TransactionStatus.PENDING,
    "posted": lambda t: _status(t) is TransactionStatus.POSTED,
    "cleared": lambda t: _status(t) is TransactionStatus.CLEARED,
}


def test_seed_populates_db(session: Session) -> None:
    seed(session, logger)

    assert len(session.exec(select(Currency)).all()) > 0
    assert len(session.exec(select(Category)).all()) > 0
    assert len(session.exec(select(Account)).all()) > 0
    assert len(session.exec(select(TransactionTag)).all()) > 0
    assert len(session.exec(select(TransactionTagLink)).all()) > 0


def test_seeded_categories_respect_parent_links(session: Session) -> None:
    seed(session, logger)

    rows = session.exec(select(Category)).all()
    known_ids = {c.id for c in rows}
    for cat in rows:
        if cat.parent_id is not None:
            assert cat.parent_id in known_ids


def test_seeded_accounts_link_to_real_currencies(session: Session) -> None:
    seed(session, logger)

    currency_codes = {c.code for c in session.exec(select(Currency)).all()}
    for account in session.exec(select(Account)).all():
        assert account.currency_code in currency_codes


def test_seeded_transaction_tag_links_reference_real_rows(session: Session) -> None:
    seed(session, logger)

    transaction_ids = {t.id for t in session.exec(select(Transaction)).all()}
    tag_ids = {t.id for t in session.exec(select(TransactionTag)).all()}
    links = session.exec(select(TransactionTagLink)).all()
    assert len(links) > 0
    for link in links:
        assert link.transaction_id in transaction_ids
        assert link.transaction_tag_id in tag_ids


def test_seeded_transactions_reference_real_statements(session: Session) -> None:
    seed(session, logger)

    account_ids = {a.id for a in session.exec(select(Account)).all()}
    statements = {s.id: s for s in session.exec(select(Statement)).all()}
    assert len(statements) > 0
    for statement in statements.values():
        assert statement.account_id in account_ids

    billed = [
        t for t in session.exec(select(Transaction)).all() if t.statement_id is not None
    ]
    assert len(billed) > 0
    for transaction in billed:
        statement = statements[transaction.statement_id]
        assert transaction.account_id == statement.account_id
        assert (
            statement.period_start_on
            <= transaction.created_at.date()
            <= statement.period_end_on
        )


def test_seeded_event_labels_match_state(session: Session) -> None:
    seed(session, logger)

    for event in session.exec(select(Event)).all():
        for label in _labels(event.description):
            assert label in EVENT_LABEL_CHECKS, f"event id={event.id}: {label!r}"
            assert EVENT_LABEL_CHECKS[label](event), f"event id={event.id}: {label!r}"


def test_seeded_transaction_labels_match_state(session: Session) -> None:
    seed(session, logger)

    for txn in session.exec(select(Transaction)).all():
        for label in _labels(txn.description):
            assert label in TRANSACTION_LABEL_CHECKS, f"txn id={txn.id}: {label!r}"
            assert TRANSACTION_LABEL_CHECKS[label](txn), f"txn id={txn.id}: {label!r}"
