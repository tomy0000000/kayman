from decimal import Decimal
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from kayman.schemas.event import Event
    from kayman.schemas.transaction import Transaction


class TransactionEventLinkBase(SQLModel):
    transaction_id: int = Field(foreign_key="transaction.id", ondelete="CASCADE")
    event_id: int = Field(foreign_key="event.id", ondelete="CASCADE")
    # The share of the transaction's amount that this event claims
    amount: Decimal
    # Negatives are reserved for park_moving_indexes in crud/util.py
    index: int = Field(ge=0, description="Position among the legs of the same event")


class TransactionEventLink(TransactionEventLinkBase, table=True):
    __tablename__ = "transaction_event_link"
    __table_args__ = (
        UniqueConstraint(
            "transaction_id",
            "event_id",
            name="transaction_event_link_transaction_id_event_id_key",
        ),
        UniqueConstraint(
            "event_id", "index", name="transaction_event_link_event_id_index_key"
        ),
    )
    id: int | None = Field(primary_key=True, default=None)
    transaction: "Transaction" = Relationship(back_populates="event_links")
    event: "Event" = Relationship(back_populates="transaction_links")


class TransactionEventLinkCreate(TransactionEventLinkBase):
    pass


# A link never moves between transactions or events: delete and recreate it
class TransactionEventLinkUpdate(SQLModel):
    id: int
    amount: Decimal | None = None
    index: int | None = Field(default=None, ge=0)
