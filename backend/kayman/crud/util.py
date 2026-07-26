from collections.abc import Sequence
from typing import Any, Protocol

from sqlmodel import Session


class Indexed(Protocol):
    # Any, not int | None: the attribute is read-write, so a Protocol declaring
    # int | None would reject EventEntry, whose index is a plain int.
    index: Any


def park_moving_indexes(
    session: Session,
    rows: Sequence[Indexed],
    updates: Sequence[dict[str, Any]],
) -> None:
    """Vacate the target index range before a batch write lands on it.

    The unique constraint on indexes is checked per row mid-flush, so
    writing targets directly collides with rows not updated yet. Caller order is
    no lever: SQLAlchemy orders UPDATEs by primary key.

    Negatives are reserved for parking, enforced by ge=0 on the boundary schemas.
    Nothing that can raise may run between this call and writing the real
    indexes, or a swallowed error strands rows here. Validate first, then park.
    """
    moving = [
        row
        for row, data in zip(rows, updates, strict=True)
        if "index" in data and data["index"] != row.index
    ]
    if not moving:
        return

    for park, row in enumerate(moving, start=1):
        row.index = -park
    session.flush()
