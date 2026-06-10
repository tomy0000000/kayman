import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

import sqlmodel
from pydantic_extra_types.timezone_name import TimeZoneName
from sqlmodel import Column, DateTime, Field, Relationship, SQLModel, UniqueConstraint

from kayman.schemas._custom_types import SATimezone

if TYPE_CHECKING:
    from kayman.schemas.category import Category
    from kayman.schemas.currency import Currency
    from kayman.schemas.transaction import Transaction

#
# Payment Category
#


class PaymentType(enum.Enum):
    Expense = "Expense"
    Income = "Income"
    Transfer = "Transfer"
    Exchange = "Exchange"


#
# Payment
#


class PaymentBase(SQLModel):
    type: PaymentType = Field(
        sa_column=Column(sqlmodel.Enum(PaymentType), nullable=False)
    )
    timestamp: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
        title="Local timestamp, or timezone-aware timestamp",
    )
    timezone: TimeZoneName = Field(sa_column=Column(SATimezone(), nullable=False))
    description: str | None = None


class Payment(PaymentBase, table=True):
    __tablename__ = "payment"
    id: int | None = Field(primary_key=True, default=None)
    # Auto calculated for Expense or Income
    # Manually logged for Transfer or Exchange
    transactions: list["Transaction"] = Relationship(back_populates="payment")
    entries: list["PaymentEntry"] = Relationship(back_populates="payment")


class PaymentCreate(PaymentBase):
    pass


class PaymentRead(PaymentBase):
    id: int


#
# PaymentEntry
#


class PaymentEntryBase(SQLModel):
    payment_id: int = Field(foreign_key="payment.id")
    category_id: int = Field(foreign_key="category.id")
    amount: Decimal
    quantity: int
    currency_code: str = Field(foreign_key="currency.code")
    description: str | None = None
    index: int


class PaymentEntry(PaymentEntryBase, table=True):
    __tablename__ = "payment_entry"
    __table_args__ = (
        UniqueConstraint(
            "payment_id", "index", name="payment_entry_payment_id_index_key"
        ),
    )
    id: int | None = Field(primary_key=True, default=None)
    payment: Payment = Relationship(back_populates="entries")
    category: "Category" = Relationship(back_populates="entries")
    currency: "Currency" = Relationship(back_populates="entries")


class PaymentEntryCreate(SQLModel):
    category_id: int
    amount: Decimal
    quantity: int
    currency_code: str
    description: str | None = None


class PaymentEntryRead(PaymentEntryBase):
    id: int
    payment_id: int
