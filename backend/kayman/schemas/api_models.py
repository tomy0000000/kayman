"""Composite Models for direct use in the API."""

from sqlmodel import SQLModel

from kayman.schemas.event import (
    EventCreate,
    EventRead,
    PaymentEntryCreate,
    PaymentEntryRead,
)
from kayman.schemas.transaction import TransactionCreate, TransactionRead


class PaymentReadDetailed(EventRead):
    """Includes transactions and entries."""

    transactions: list[TransactionRead]
    entries: list[PaymentEntryRead]


class PaymentCreateDetailed(SQLModel):
    """Includes transactions and entries."""

    payment: EventCreate
    transactions: list[TransactionCreate]
    entries: list[PaymentEntryCreate]
