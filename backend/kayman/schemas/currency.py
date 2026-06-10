from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from kayman.schemas.account import Account
    from kayman.schemas.payment import PaymentEntry


class Currency(SQLModel, table=True):
    __tablename__ = "currency"
    code: str = Field(primary_key=True)
    name: str
    symbol: str
    accounts: list["Account"] = Relationship(back_populates="currency")
    entries: list["PaymentEntry"] = Relationship(back_populates="currency")
