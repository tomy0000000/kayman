"""Composite Models for direct use in the API."""

from sqlmodel import SQLModel

from kayman.schemas.event import EventCreate, EventRead
from kayman.schemas.event_entry import EventEntryCreate, EventEntryRead
from kayman.schemas.transaction import TransactionCreate, TransactionRead


class EventReadDetailed(EventRead):
    """Includes transactions and entries."""

    transactions: list[TransactionRead]
    entries: list[EventEntryRead]


# TODO: test-only after legacy_create removal, remove once validate_total is gone
class EventCreateDetailed(SQLModel):
    """Includes transactions and entries."""

    event: EventCreate
    transactions: list[TransactionCreate]
    entries: list[EventEntryCreate]
