"""Seed the dev database with mock data from backend/mock_data/."""

from __future__ import annotations

import argparse
import sys
from typing import TYPE_CHECKING

from loguru import logger
from sqlmodel import Session

from kayman.core.config import settings
from kayman.core.db import engine
from kayman.mock_data import load_records
from kayman.schemas.currency import Currency

if TYPE_CHECKING:
    from loguru import Logger

ALLOWED_ENVIRONMENTS = {"local", "development"}


def seed(session: Session, logger: Logger) -> None:
    """reseed from mock_data/*.json."""
    currencies = load_records("currencies", Currency)
    for currency in currencies:
        session.add(currency)
    session.commit()
    logger.success(f"Currencies seeded: {len(currencies)}")


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
