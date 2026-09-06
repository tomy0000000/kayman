import enum
from datetime import datetime
from typing import TYPE_CHECKING

import sqlmodel
from pydantic_extra_types.timezone_name import TimeZoneName
from sqlmodel import Column, DateTime, Field, Relationship, SQLModel

from kayman.schemas._custom_types import SATimezone

if TYPE_CHECKING:
    from kayman.schemas.event_entry import EventEntry
    from kayman.schemas.transaction import Transaction


class EventType(enum.Enum):
    Expense = "Expense"
    Income = "Income"
    Transfer = "Transfer"
    Exchange = "Exchange"


class EventClearErrorType(enum.Enum):
    ALREADY_CLEARED = "already_cleared"
    NO_ENTRIES = "no_entries"
    NO_TRANSACTIONS = "no_transactions"
    TRANSACTIONS_NOT_POSTED = "transactions_not_posted"
    TOTALS_MISMATCH = "totals_mismatch"
    EMPTY_ENTRIES_DESCRIPTION = "empty_entries_description"
    INCONSISTENT_TIMESTAMPS = "inconsistent_timestamps"


class EventBase(SQLModel):
    type: EventType
    timestamp: datetime
    timezone: TimeZoneName
    description: str | None = None
    cleared_at: datetime | None = None


class Event(EventBase, table=True):
    id: int | None = Field(primary_key=True, default=None)
    type: EventType = Field(sa_column=Column(sqlmodel.Enum(EventType), nullable=False))
    timestamp: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    timezone: TimeZoneName = Field(sa_column=Column(SATimezone(), nullable=False))
    cleared_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    # Auto calculated for Expense or Income
    # Manually logged for Transfer or Exchange
    transactions: list["Transaction"] = Relationship(
        back_populates="event",
        sa_relationship_kwargs={"order_by": "Transaction.index"},
    )
    entries: list["EventEntry"] = Relationship(
        back_populates="event",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "EventEntry.index"},
    )


class EventCreate(EventBase):
    pass


class EventRead(EventBase):
    id: int


class EventClear(SQLModel):
    cleared_at: datetime


class EventClearError(SQLModel):
    type: EventClearErrorType
    msg: str


class EventClearable(SQLModel):
    """Whether an event can be cleared, and every reason it cannot."""

    clearable: bool
    errors: list[EventClearError]


class EventClearConflict(SQLModel):
    """The 409 body. FastAPI's HTTPException always wraps its detail."""

    detail: list[EventClearError]


class EventUpdate(SQLModel):
    type: EventType | None = None
    timestamp: datetime | None = None
    timezone: TimeZoneName | None = None
    description: str | None = None
