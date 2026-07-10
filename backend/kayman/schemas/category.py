from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from kayman.schemas.event import EventEntry


class CategoryBase(SQLModel):
    name: str
    description: str | None = None
    disabled: bool = Field(default=False)
    parent_id: int | None = Field(foreign_key="category.id", default=None)


class Category(CategoryBase, table=True):
    id: int | None = Field(primary_key=True, default=None)
    entries: list["EventEntry"] = Relationship(back_populates="category")
    parent_category: Optional["Category"] = Relationship(
        back_populates="sub_categories",
        sa_relationship_kwargs={"remote_side": "Category.id"},
    )
    sub_categories: list["Category"] = Relationship(back_populates="parent_category")


class CategoryCreate(CategoryBase):
    pass


class CategoryRead(CategoryBase):
    id: int


class CategoryReadWithChildren(CategoryRead):
    sub_categories: list["CategoryReadWithChildren"] | None = None
