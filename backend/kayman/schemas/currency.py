from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from kayman.schemas.account import Account
    from kayman.schemas.event_entry import EventEntry


class CurrencyBase(SQLModel):
    code: str
    name: str
    symbol: str


class Currency(CurrencyBase, table=True):
    code: str = Field(primary_key=True)
    accounts: list["Account"] = Relationship(back_populates="currency")
    entries: list["EventEntry"] = Relationship(back_populates="currency")


class CurrencyCreate(CurrencyBase):
    pass


class CurrencyRead(CurrencyBase):
    pass
