"""Seed the dev database with mock data from backend/mock_data/."""

from __future__ import annotations

import argparse
import sys
from typing import TYPE_CHECKING

from loguru import logger
from sqlalchemy import text
from sqlmodel import Session

from kayman.core.config import settings
from kayman.core.db import engine
from kayman.mock_data import load_records
from kayman.schemas.account import Account
from kayman.schemas.category import Category
from kayman.schemas.currency import Currency
from kayman.schemas.event import Event
from kayman.schemas.event_entry import EventEntry
from kayman.schemas.transaction import Transaction
from kayman.schemas.transaction_tag import TransactionTag, TransactionTagLink

if TYPE_CHECKING:
    from loguru import Logger

ALLOWED_ENVIRONMENTS = {"local", "development"}


def _resync_id_sequence(session: Session, table: str) -> None:
    """Advance the id sequence past the largest seeded id (Postgres only)."""
    if session.bind is None or session.bind.dialect.name != "postgresql":
        return
    quoted = f'"{table}"'
    session.connection().execute(
        text(
            f"SELECT setval("
            f"pg_get_serial_sequence(:table, 'id'), "
            f"COALESCE((SELECT MAX(id) FROM {quoted}), 1), "
            f"(SELECT MAX(id) FROM {quoted}) IS NOT NULL"
            f")"
        ),
        {"table": table},
    )
    session.commit()


def seed(session: Session, logger: Logger) -> None:
    """reseed from mock_data/*.json."""
    currencies = load_records("currencies", Currency)
    for currency in currencies:
        session.add(currency)
    session.commit()
    logger.success(f"Currencies seeded: {len(currencies)}")

    categories = load_records("categories", Category)
    for category in sorted(categories, key=lambda c: c.id or 0):
        session.add(category)
    session.commit()
    _resync_id_sequence(session, "category")
    logger.success(f"Categories seeded: {len(categories)}")

    accounts = load_records("accounts", Account)
    for account in sorted(accounts, key=lambda a: a.id or 0):
        session.add(account)
    session.commit()
    _resync_id_sequence(session, "account")
    logger.success(f"Accounts seeded: {len(accounts)}")

    events = load_records("events", Event, datetime_fields=["timestamp"])
    for event in sorted(events, key=lambda e: e.id or 0):
        session.add(event)
    session.commit()
    _resync_id_sequence(session, "event")
    logger.success(f"Events seeded: {len(events)}")

    event_entries = load_records("event_entries", EventEntry)
    for event_entry in sorted(event_entries, key=lambda e: e.id or 0):
        session.add(event_entry)
    session.commit()
    _resync_id_sequence(session, "event_entry")
    logger.success(f"Event entries seeded: {len(event_entries)}")

    transactions = load_records(
        "transactions",
        Transaction,
        datetime_fields=["created_at", "posted_at", "cleared_at"],
    )
    for transaction in sorted(transactions, key=lambda t: t.id or 0):
        session.add(transaction)
    session.commit()
    _resync_id_sequence(session, "transaction")
    logger.success(f"Transactions seeded: {len(transactions)}")

    transaction_tags = load_records("transaction_tags", TransactionTag)
    for transaction_tag in sorted(transaction_tags, key=lambda t: t.id or 0):
        session.add(transaction_tag)
    session.commit()
    _resync_id_sequence(session, "transaction_tag")
    logger.success(f"Transaction tags seeded: {len(transaction_tags)}")

    transaction_tag_links = load_records("transaction_tag_links", TransactionTagLink)
    for transaction_tag_link in transaction_tag_links:
        session.add(transaction_tag_link)
    session.commit()
    logger.success(f"Transaction tag links seeded: {len(transaction_tag_links)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            f"Seed even when ENVIRONMENT is not one of {sorted(ALLOWED_ENVIRONMENTS)}."
        ),
    )
    args = parser.parse_args()

    if settings.ENVIRONMENT not in ALLOWED_ENVIRONMENTS and not args.force:
        logger.error(
            f"Refusing to seed: ENVIRONMENT={settings.ENVIRONMENT!r} is not in "
            f"{sorted(ALLOWED_ENVIRONMENTS)}. Pass --force to override."
        )
        return 1

    logger.info(f"Seeding mock data into {settings.ENVIRONMENT} database")
    with Session(engine) as session:
        seed(session, logger)
    logger.success("Seed complete")

    return 0


if __name__ == "__main__":
    sys.exit(main())
