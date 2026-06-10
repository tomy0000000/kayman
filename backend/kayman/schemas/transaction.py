from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlmodel import Column, DateTime, Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from kayman.schemas.account import Account
    from kayman.schemas.payment import Payment


class TransactionBase(SQLModel):
    account_id: int = Field(foreign_key="account.id")
    payment_id: int = Field(foreign_key="payment.id")
    amount: Decimal
    created_at: datetime = Field(default=datetime.now)
    posted_at: datetime | None = None
    description: str | None = None
    reconcile: bool = False
    index: int


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
    account: "Account" = Relationship(back_populates="transactions")
    payment: "Payment" = Relationship(back_populates="transactions")


class TransactionCreate(SQLModel):
    account_id: int
    amount: Decimal
    created_at: datetime
    posted_at: datetime | None = None
    description: str | None = None
    reconcile: bool = False


class TransactionRead(TransactionBase):
    id: int
    payment_id: int
    created_at: datetime
