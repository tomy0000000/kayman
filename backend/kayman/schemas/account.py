from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic_extra_types.timezone_name import TimeZoneName
from sqlmodel import Column, Field, Relationship, SQLModel

from kayman.schemas._custom_types import SATimezone

if TYPE_CHECKING:
    from kayman.schemas.currency import Currency
    from kayman.schemas.statement import Statement
    from kayman.schemas.transaction import Transaction


class AccountBase(SQLModel):
    name: str
    currency_code: str = Field(foreign_key="currency.code")
    timezone: TimeZoneName


class Account(AccountBase, table=True):
    id: int | None = Field(primary_key=True, default=None)
    balance: Decimal
    timezone: TimeZoneName = Field(sa_column=Column(SATimezone(), nullable=False))
    currency: "Currency" = Relationship(back_populates="accounts")
    statements: list["Statement"] = Relationship(back_populates="account")
    transactions: list["Transaction"] = Relationship(back_populates="account")


class AccountCreate(AccountBase):
    pass


class AccountRead(AccountBase):
    id: int
    balance: Decimal
    timezone: TimeZoneName


class AccountUpdate(SQLModel):
    name: str | None = None
