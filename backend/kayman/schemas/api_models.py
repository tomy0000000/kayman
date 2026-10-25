"""Composite Models for direct use in the API."""

from kayman.schemas.event import EventRead
from kayman.schemas.event_entry import EventEntryRead
from kayman.schemas.transaction import TransactionRead


class EventReadDetailed(EventRead):
    """Includes transactions and entries."""

    transactions: list[TransactionRead]
    entries: list[EventEntryRead]
