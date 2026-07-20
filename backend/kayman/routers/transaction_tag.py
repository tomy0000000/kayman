from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.transaction_tag import (
    create_transaction_tags,
    read_transaction_tags,
    update_transaction_tags,
)
from kayman.schemas.transaction_tag import (
    TransactionTagBase,
    TransactionTagCreate,
    TransactionTagRead,
    TransactionTagUpdate,
)

TAG_NAME = "Transaction Tag"
tag = {
    "name": TAG_NAME,
    "description": "Create and manage transaction tags",
}

transaction_tag_router = APIRouter(
    prefix="/transaction-tags",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)


@transaction_tag_router.post(
    "", name="Create Transaction Tag", response_model=TransactionTagRead
)
def create(
    *, session: Session = Depends(get_session), transaction_tag: TransactionTagCreate
) -> TransactionTagBase:
    try:
        return create_transaction_tags(session, [transaction_tag])[0]
    except IntegrityError as err:
        raise HTTPException(
            status_code=409, detail="Transaction tag name already exists"
        ) from err


@transaction_tag_router.get(
    "", name="Read Transaction Tags", response_model=list[TransactionTagRead]
)
def reads(
    *, session: Session = Depends(get_session), archived: bool | None = None
) -> Sequence[TransactionTagBase]:
    return read_transaction_tags(session, archived=archived)


@transaction_tag_router.patch(
    "/{transaction_tag_id}",
    name="Update Transaction Tag",
    response_model=TransactionTagRead,
)
def update(
    *,
    session: Session = Depends(get_session),
    transaction_tag_id: int,
    transaction_tag: TransactionTagUpdate,
) -> TransactionTagBase:
    try:
        return update_transaction_tags(
            session, [transaction_tag_id], [transaction_tag]
        )[0]
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
    except IntegrityError as err:
        raise HTTPException(
            status_code=409, detail="Transaction tag name already exists"
        ) from err
