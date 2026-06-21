import json
from datetime import date, timedelta
from pathlib import Path

from pydantic import BaseModel

MOCK_DATA_DIR = Path(__file__).resolve().parents[2] / "mock_data"
BASE_DATE = date(2026, 2, 1)


def _recent_shift() -> timedelta:
    """Offset from BASE_DATE to the first day of last month."""
    today = date.today()
    first_of_this_month = today.replace(day=1)
    first_of_last_month = (first_of_this_month - timedelta(days=1)).replace(day=1)
    return first_of_last_month - BASE_DATE


def load_records[T: BaseModel](
    entity: str,
    schema: type[T],
    datetime_fields: list[str] | None = None,
) -> list[T]:
    """Load a JSON array of records, validating each item.

    When `datetime_fields` is given, each named datetime is shifted from
    BASE_DATE onto the first day of last month so seed data stays anchored
    near "now".
    """
    path = MOCK_DATA_DIR / f"{entity}.json"
    raw = json.loads(path.read_text())
    records = [schema.model_validate(item) for item in raw]

    if datetime_fields:
        shift = _recent_shift()
        for record in records:
            for field in datetime_fields:
                value = getattr(record, field)
                if value is not None:
                    setattr(record, field, value + shift)

    return records
