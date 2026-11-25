from collections.abc import Sequence
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.transaction_event_link import create_transaction_event_links
from kayman.logics.transaction_event_link import (
    delete_transaction_event_links_by_ids,
    require_link_targets,
    update_transaction_event_links_by_ids,
    validate_transaction_event_links_creatable,
    validate_transaction_event_links_editable,
)
from kayman.schemas.transaction_event_link import (
    TransactionEventLink,
    TransactionEventLinkCreate,
    TransactionEventLinkRead,
    TransactionEventLinkUpdate,
)

TAG_NAME = "Transaction Event Link"
tag = {
    "name": TAG_NAME,
    "description": "Link transactions to events, each with its share of the amount",
}

transaction_event_link_router = APIRouter(
    prefix="/transaction-event-links",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)

CONFLICT: dict[int | str, dict[str, Any]] = {
    409: {
        "description": (
            "Transaction or event is cleared, the pair is already linked, or the "
            "position is taken"
        )
    }
}


@transaction_event_link_router.post(
    "",
    name="Create Transaction Event Links",
    response_model=list[TransactionEventLinkRead],
    responses=CONFLICT,
)
def create_links(
    *,
    session: Session = Depends(get_session),
    links: list[TransactionEventLinkCreate],
) -> Sequence[TransactionEventLink]:
    try:
        require_link_targets(session, links)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
    try:
        validate_transaction_event_links_creatable(session, links)
    except ValueError as err:
        raise HTTPException(status_code=409, detail=err.args[0]) from err
    return create_transaction_event_links(session, links)


@transaction_event_link_router.patch(
    "",
    name="Update Transaction Event Links",
    response_model=list[TransactionEventLinkRead],
    responses=CONFLICT,
)
def update_links(
    *,
    session: Session = Depends(get_session),
    links: list[TransactionEventLinkUpdate],
) -> Sequence[TransactionEventLink]:
    try:
        validate_transaction_event_links_editable(
            session,
            [link.id for link in links],
            {link.id: link.index for link in links if link.index is not None},
        )
    except ValueError as err:
        raise HTTPException(status_code=409, detail=err.args[0]) from err
    try:
        return update_transaction_event_links_by_ids(session, links)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err


@transaction_event_link_router.delete(
    "",
    name="Delete Transaction Event Links",
    responses=CONFLICT,
)
def delete_links(
    *,
    session: Session = Depends(get_session),
    ids: Annotated[list[int], Query()],
) -> None:
    try:
        validate_transaction_event_links_editable(session, set(ids))
    except ValueError as err:
        raise HTTPException(status_code=409, detail=err.args[0]) from err
    try:
        delete_transaction_event_links_by_ids(session, ids)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
