from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from kayman.schemas.transaction import Transaction


class TransactionTagLink(SQLModel, table=True):
    __tablename__ = "transaction_tag_link"

    transaction_id: int = Field(
        foreign_key="transaction.id", primary_key=True, ondelete="CASCADE"
    )
    transaction_tag_id: int = Field(
        foreign_key="transaction_tag.id", primary_key=True, ondelete="CASCADE"
    )


class TransactionTagBase(SQLModel):
    name: str
    archived: bool = Field(default=False)


class TransactionTag(TransactionTagBase, table=True):
    __tablename__ = "transaction_tag"
    __table_args__ = (UniqueConstraint("name", name="transaction_tag_name_key"),)
    id: int | None = Field(primary_key=True, default=None)
    transactions: list["Transaction"] = Relationship(
        back_populates="tags", link_model=TransactionTagLink
    )


class TransactionTagCreate(TransactionTagBase):
    pass


class TransactionTagRead(TransactionTagBase):
    id: int


class TransactionTagUpdate(SQLModel):
    name: str | None = None
    archived: bool | None = None
