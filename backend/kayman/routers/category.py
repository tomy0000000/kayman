from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.schemas.category import (
    Category,
    CategoryBase,
    CategoryCreate,
    CategoryRead,
    CategoryReadWithChildren,
)

TAG_NAME = "Category"
tag = {
    "name": TAG_NAME,
    "description": "Create and manage payment entry categories",
}

category_router = APIRouter(
    prefix="/categories",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)


@category_router.post("", name="Create Category", response_model=CategoryRead)
def create(
    *, session: Session = Depends(get_session), category: CategoryCreate
) -> CategoryBase:
    db_category = Category.model_validate(category)
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return db_category


@category_router.get(
    "", name="Read Categories", response_model=list[CategoryReadWithChildren]
)
def reads(*, session: Session = Depends(get_session)) -> Sequence[CategoryBase]:
    categories = session.exec(
        select(Category).where(
            # https://github.com/fastapi/sqlmodel/issues/109
            Category.parent_id == None,  # noqa E711 Comparison to `None` should be `cond is None`.
        )
    ).all()
    return categories


@category_router.get(
    "/{id}", name="Read Category", response_model=CategoryReadWithChildren
)
def read(*, session: Session = Depends(get_session), id: int) -> CategoryBase:
    category = session.get(Category, id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@category_router.patch("", name="Update Category", response_model=CategoryRead)
def update(
    *, session: Session = Depends(get_session), category: Category
) -> CategoryBase:
    session.merge(category)
    session.commit()
    session.refresh(category)
    return category


# TODO: Think about how this should work
# @category_router.delete("/{id}")
# def delete_category(*, session: Session = Depends(get_session), id: int):
#     category = session.query(Category).get(id)
#     if category is None:
#         raise HTTPException(status_code=404, detail="Category not found")
#     session.delete(category)
#     session.commit()
