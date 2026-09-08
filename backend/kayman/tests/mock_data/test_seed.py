from loguru import logger
from sqlmodel import Session, select

from kayman.mock_data.seed import seed
from kayman.schemas.account import Account
from kayman.schemas.category import Category
from kayman.schemas.currency import Currency
from kayman.schemas.statement import Statement
from kayman.schemas.transaction import Transaction
from kayman.schemas.transaction_tag import TransactionTag, TransactionTagLink


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
