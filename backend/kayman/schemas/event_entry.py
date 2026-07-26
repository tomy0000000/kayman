from decimal import Decimal
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from kayman.schemas.category import Category
    from kayman.schemas.currency import Currency
    from kayman.schemas.event import Event


class EventEntryBase(SQLModel):
    event_id: int = Field(foreign_key="event.id")
    category_id: int = Field(foreign_key="category.id")
    amount: Decimal
    quantity: int
    currency_code: str = Field(foreign_key="currency.code")
    description: str | None = None
    # Negatives are reserved for park_moving_indexes in crud/util.py. Not a DB
    # check: parking flushes negatives, and PG checks cannot be deferred.
    index: int = Field(ge=0)


class EventEntry(EventEntryBase, table=True):
    __tablename__ = "event_entry"
    __table_args__ = (
        UniqueConstraint("event_id", "index", name="event_entry_event_id_index_key"),
    )
    id: int | None = Field(primary_key=True, default=None)
    event: "Event" = Relationship(back_populates="entries")
    category: "Category" = Relationship(back_populates="entries")
    currency: "Currency" = Relationship(back_populates="entries")


class EventEntryCreate(EventEntryBase):
    pass


class EventEntryRead(EventEntryBase):
    id: int
    event_id: int


class EventEntryUpdate(SQLModel):
    id: int
    event_id: int | None = None
    category_id: int | None = None
    amount: Decimal | None = None
    quantity: int | None = None
    currency_code: str | None = None
    description: str | None = None
    index: int | None = Field(default=None, ge=0)
