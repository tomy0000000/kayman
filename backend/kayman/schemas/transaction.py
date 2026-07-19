import enum
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from pydantic import computed_field
from sqlmodel import Column, DateTime, Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from kayman.schemas.account import Account
    from kayman.schemas.event import Event


class TransactionBase(SQLModel):
    account_id: int = Field(foreign_key="account.id")
    event_id: int | None = Field(foreign_key="event.id", default=None)
    amount: Decimal
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    posted_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    description: str | None = None
    reconciled_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    index: int | None = None


class Transaction(TransactionBase, table=True):
    __table_args__ = (
        UniqueConstraint("event_id", "index", name="transaction_event_id_index_key"),
    )
    id: int | None = Field(primary_key=True, default=None)
    account: "Account" = Relationship(back_populates="transactions")
    event: Optional["Event"] = Relationship(back_populates="transactions")

    @property
    def currency_code(self) -> str:
        return self.account.currency_code


class TransactionCreate(TransactionBase):
    pass


class TransactionStatus(enum.Enum):
    PENDING = "PENDING"
    POSTED = "POSTED"
    CLEARED = "CLEARED"


class TransactionRead(TransactionBase):
    id: int
    created_at: datetime
    currency_code: str

    @computed_field
    def status(self) -> TransactionStatus:
        if self.reconciled_at is not None:
            return TransactionStatus.CLEARED
        if self.posted_at is not None:
            return TransactionStatus.POSTED
        return TransactionStatus.PENDING


class TransactionReadWithBalance(TransactionRead):
    running_balance: Decimal


class TransactionPost(SQLModel):
    posted_at: datetime
    amount: Decimal | None = None


class TransactionUpdate(SQLModel):
    id: int
    account_id: int | None = None
    event_id: int | None = None
    amount: Decimal | None = None
    created_at: datetime | None = None
    posted_at: datetime | None = None
    description: str | None = None
    reconciled_at: datetime | None = None
    index: int | None = None
