from collections.abc import Sequence
from typing import Literal

from sqlmodel import Session, col, select

from kayman.schemas.category import Category


def read_categories(
    session: Session,
    parent_id: int | Literal["empty"] | None = None,
) -> Sequence[Category]:
    scalar = select(Category)
    if parent_id == "empty":
        scalar = scalar.where(col(Category.parent_id).is_(None))
    elif parent_id is not None:
        scalar = scalar.where(Category.parent_id == parent_id)
    # index is sibling-scoped and not unique, so name breaks ties deterministically
    scalar = scalar.order_by(col(Category.index), col(Category.name))
    categories = session.exec(scalar).all()
    return categories
