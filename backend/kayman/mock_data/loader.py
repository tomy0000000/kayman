import json
from pathlib import Path

from pydantic import BaseModel

MOCK_DATA_DIR = Path(__file__).resolve().parents[2] / "mock_data"


def load_records[T: BaseModel](entity: str, schema: type[T]) -> list[T]:
    """Load a JSON array of records, validating each item."""
    path = MOCK_DATA_DIR / f"{entity}.json"
    raw = json.loads(path.read_text())
    return [schema.model_validate(item) for item in raw]
