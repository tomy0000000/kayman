from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from kayman.schemas.event_entry import EventEntry


class CategoryBase(SQLModel):
    name: str
    description: str | None = None
    disabled: bool = Field(default=False)
    parent_id: int | None = Field(foreign_key="category.id", default=None)
    index: int = Field(
        default=0, ge=0
    )  # Position among siblings sharing the same parent_id


class Category(CategoryBase, table=True):
    id: int | None = Field(primary_key=True, default=None)
    entries: list["EventEntry"] = Relationship(back_populates="category")
    parent_category: Optional["Category"] = Relationship(
        back_populates="sub_categories",
        sa_relationship_kwargs={"remote_side": "Category.id"},
    )
    sub_categories: list["Category"] = Relationship(
        back_populates="parent_category",
        sa_relationship_kwargs={"order_by": "Category.index, Category.name"},
    )


class CategoryCreate(CategoryBase):
    pass


class CategoryRead(CategoryBase):
    id: int


class CategoryReadWithChildren(CategoryRead):
    sub_categories: list["CategoryReadWithChildren"] | None = None
