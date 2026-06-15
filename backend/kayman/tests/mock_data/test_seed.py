from loguru import logger
from sqlmodel import Session, select

from kayman.mock_data.seed import seed
from kayman.schemas.account import Account
from kayman.schemas.category import Category
from kayman.schemas.currency import Currency


def test_seed_populates_db(session: Session) -> None:
    seed(session, logger)

    assert len(session.exec(select(Currency)).all()) > 0
    assert len(session.exec(select(Category)).all()) > 0
    assert len(session.exec(select(Account)).all()) > 0


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
