"""Composite Models for direct use in the API."""

from sqlmodel import SQLModel

from kayman.schemas.event import (
    EventCreate,
    EventEntryCreate,
    EventEntryRead,
    EventRead,
)
from kayman.schemas.transaction import TransactionCreate, TransactionRead


class EventReadDetailed(EventRead):
    """Includes transactions and entries."""

    transactions: list[TransactionRead]
    entries: list[EventEntryRead]


class EventCreateDetailed(SQLModel):
    """Includes transactions and entries."""

    event: EventCreate
    transactions: list[TransactionCreate]
    entries: list[EventEntryCreate]
