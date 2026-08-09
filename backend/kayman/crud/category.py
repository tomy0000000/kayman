from collections.abc import Collection, Sequence
from typing import Literal

from sqlmodel import Session, col, select

from kayman.schemas.category import Category, CategoryUpdate


def read_categories(
    session: Session,
    category_ids: Collection[int] | None = None,
    parent_id: int | Literal["empty"] | None = None,
    for_update: bool = False,
) -> Sequence[Category]:
    scalar = select(Category)
    if category_ids:
        scalar = scalar.where(col(Category.id).in_(category_ids))
    if parent_id == "empty":
        scalar = scalar.where(col(Category.parent_id).is_(None))
    elif parent_id is not None:
        scalar = scalar.where(Category.parent_id == parent_id)
    # index is sibling-scoped and not unique, so name breaks ties deterministically
    scalar = scalar.order_by(col(Category.index), col(Category.name))
    if for_update:
        scalar = scalar.with_for_update()
    categories = session.exec(scalar).all()
    return categories


def update_categories(
    session: Session,
    previous_categories: Sequence[Category],
    updates: Sequence[CategoryUpdate],
    commit: bool = True,
) -> Sequence[Category]:
    # Pair by id, not by row order: read_categories orders by (index, name), so
    # positional pairing would misassign rows to updates
    id_to_db_category = {category.id: category for category in previous_categories}
    for update in updates:
        db_category = id_to_db_category[update.id]
        data = update.model_dump(exclude_unset=True, exclude={"id"})
        db_category.sqlmodel_update(data)

    session.add_all(previous_categories)
    if commit:
        session.commit()
        for db_category in previous_categories:
            session.refresh(db_category)
    else:
        session.flush()

    return previous_categories
