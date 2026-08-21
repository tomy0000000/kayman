from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.category import read_categories
from kayman.logics.category import CategoryCycleError, update_categories_by_ids
from kayman.schemas.category import (
    Category,
    CategoryBase,
    CategoryCreate,
    CategoryRead,
    CategoryReadWithChildren,
    CategoryUpdate,
)

TAG_NAME = "Category"
tag = {
    "name": TAG_NAME,
    "description": "Create and manage event entry categories",
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


@category_router.get("", name="Read Categories", response_model=list[CategoryRead])
def reads(*, session: Session = Depends(get_session)) -> Sequence[CategoryBase]:
    return read_categories(session)


@category_router.get(
    "/tree", name="Read Category Tree", response_model=list[CategoryReadWithChildren]
)
def read_tree(*, session: Session = Depends(get_session)) -> Sequence[CategoryBase]:
    return read_categories(session, parent_id="empty")


@category_router.get(
    "/{id}", name="Read Category", response_model=CategoryReadWithChildren
)
def read(*, session: Session = Depends(get_session), id: int) -> CategoryBase:
    category = session.get(Category, id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@category_router.patch("", name="Update Categories", response_model=list[CategoryRead])
def updates(
    *,
    session: Session = Depends(get_session),
    categories: list[CategoryUpdate],
) -> Sequence[CategoryBase]:
    try:
        return update_categories_by_ids(session, categories)
    except CategoryCycleError as err:
        # The ids stay out of the response: they are operator detail, and the
        # static message is what a user can act on
        logger.bind(moved_id=err.moved_id, new_parent_id=err.new_parent_id).warning(
            err.args[0]
        )
        raise HTTPException(status_code=400, detail=err.args[0]) from err
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err


# TODO: Think about how this should work
# @category_router.delete("/{id}")
# def delete_category(*, session: Session = Depends(get_session), id: int):
#     category = session.query(Category).get(id)
#     if category is None:
#         raise HTTPException(status_code=404, detail="Category not found")
#     session.delete(category)
#     session.commit()
