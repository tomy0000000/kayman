from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic_extra_types.timezone_name import TimeZoneName
from sqlmodel import Column, DateTime, Field, Relationship, SQLModel, UniqueConstraint

from kayman.schemas._custom_types import SATimezone

if TYPE_CHECKING:
    from kayman.schemas.account import Account
    from kayman.schemas.payment import Payment


class TransactionBase(SQLModel):
    account_id: int = Field(foreign_key="account.id")
    payment_id: int = Field(foreign_key="payment.id")
    amount: Decimal
    timestamp: datetime = Field(default=datetime.now)
    timezone: TimeZoneName
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
    timestamp: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    timezone: TimeZoneName = Field(sa_column=Column(SATimezone(), nullable=False))
    account: "Account" = Relationship(back_populates="transactions")
    payment: "Payment" = Relationship(back_populates="transactions")


class TransactionCreate(SQLModel):
    account_id: int
    amount: Decimal
    timestamp: datetime
    timezone: TimeZoneName
    description: str | None = None
    reconcile: bool = False


class TransactionRead(TransactionBase):
    id: int
    payment_id: int
    timestamp: datetime
    timezone: TimeZoneName
