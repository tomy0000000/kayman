from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlmodel import Column, DateTime, Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from kayman.schemas.account import Account
    from kayman.schemas.payment import Payment


class TransactionBase(SQLModel):
    account_id: int = Field(foreign_key="account.id")
    payment_id: int | None = Field(foreign_key="payment.id", default=None)
    amount: Decimal
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    posted_at: datetime | None = None
    description: str | None = None
    reconciled_at: datetime | None = None
    index: int | None = None


class Transaction(TransactionBase, table=True):
    __tablename__ = "transaction"
    __table_args__ = (
        UniqueConstraint(
            "payment_id", "index", name="transaction_payment_id_index_key"
        ),
    )
    id: int | None = Field(primary_key=True, default=None)
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    posted_at: datetime | None = Field(
        sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    reconciled_at: datetime | None = Field(
        sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    account: "Account" = Relationship(back_populates="transactions")
    payment: Optional["Payment"] = Relationship(back_populates="transactions")


class TransactionCreate(TransactionBase):
    pass


class TransactionRead(TransactionBase):
    id: int
