from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from kayman.schemas.account import Account


class StatementBase(SQLModel):
    created_on: date = Field(default_factory=date.today)
    account_id: int = Field(foreign_key="account.id")
    period_start_on: date
    period_end_on: date
    balance: Decimal
    due_on: date


class Statement(StatementBase, table=True):
    id: int | None = Field(primary_key=True, default=None)
    account: "Account" = Relationship(back_populates="statements")


class TransactionCreate(SQLModel):
    pass


class StatementRead(StatementBase):
    id: int
    created_on: date
