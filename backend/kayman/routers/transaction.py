from collections.abc import Sequence
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.transaction import create_transactions, read_transactions
from kayman.logics.account import update_balances_with_transactions
from kayman.logics.event import validate_events_editable
from kayman.logics.transaction import (
    update_transactions_with_balances,
    validate_transactions_billable,
    validate_transactions_clearable,
    validate_transactions_editable,
    validate_transactions_postable,
)
from kayman.schemas.transaction import (
    TransactionBase,
    TransactionBill,
    TransactionClear,
    TransactionClearable,
    TransactionClearConflict,
    TransactionCreate,
    TransactionPost,
    TransactionRead,
    TransactionStatusUpdate,
    TransactionUpdate,
)

TAG_NAME = "Transaction"
tag = {
    "name": TAG_NAME,
    "description": "Query and manage transactions",
}

txn_router = APIRouter(
    prefix="/transactions",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)


@txn_router.post(
    "",
    name="Create Transaction",
    response_model=TransactionRead,
    responses={409: {"description": "Event is cleared"}},
)
def create(
    *, session: Session = Depends(get_session), transaction: TransactionCreate
) -> TransactionBase:
    if transaction.event_id is not None:
        try:
            validate_events_editable(session, [transaction.event_id])
        except ValueError as err:
            raise HTTPException(status_code=409, detail=err.args[0]) from err
    try:
        db_txns = create_transactions(session, [transaction], commit=False)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
    update_balances_with_transactions(session, [transaction], commit=False)
    session.commit()
    session.refresh(db_txns[0])
    return db_txns[0]


@txn_router.get(
    "/clearable",
    name="Read Transactions Clearable",
    response_model=dict[int, TransactionClearable],
)
def clearable(
    *,
    session: Session = Depends(get_session),
    ids: Annotated[list[int], Query()],
) -> dict[int, TransactionClearable]:
    try:
        errors = validate_transactions_clearable(session, ids)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=err.args[0]) from err
    return {
        txn_id: TransactionClearable(clearable=not txn_errors, errors=txn_errors)
        for txn_id, txn_errors in errors.items()
    }


@txn_router.get("", name="Read Transactions", response_model=list[TransactionRead])
def reads(
    *,
    session: Session = Depends(get_session),
    transaction_id: int | None = None,
    account_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    posted_start: datetime | None = None,
    posted_end: datetime | None = None,
    event_id: int | Literal["empty"] | None = None,
) -> Sequence[TransactionBase]:
    return read_transactions(
        session,
        transaction_ids=[transaction_id] if transaction_id is not None else None,
        account_id=account_id,
        start=start,
        end=end,
        posted_start=posted_start,
        posted_end=posted_end,
        event_id=event_id,
    )


@txn_router.post(
    "/post", name="Post Transactions", response_model=list[TransactionRead]
)
def posts(
    *, session: Session = Depends(get_session), posts: Sequence[TransactionPost]
) -> Sequence[TransactionBase]:
    try:
        validate_transactions_postable(session, posts)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=err.args[0]) from err
    updates = []
    for post in posts:
        update = TransactionStatusUpdate(
            id=post.transaction_id,
            posted_at=post.posted_at,
        )
        # None would null the column on update.
        if post.amount is not None:
            update.amount = post.amount
        updates.append(update)
    try:
        return update_transactions_with_balances(session, updates)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err


@txn_router.post(
    "/bill", name="Bill Transactions", response_model=list[TransactionRead]
)
def bills(
    *, session: Session = Depends(get_session), bills: Sequence[TransactionBill]
) -> Sequence[TransactionBase]:
    try:
        validate_transactions_billable(session, bills)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=err.args[0]) from err
    updates = []
    for bill in bills:
        update = TransactionStatusUpdate(
            id=bill.transaction_id,
            statement_id=bill.statement_id,
        )
        # None would null the column on update.
        if bill.amount is not None:
            update.amount = bill.amount
        updates.append(update)
    try:
        return update_transactions_with_balances(session, updates)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err


@txn_router.post(
    "/clear",
    name="Clear Transactions",
    response_model=list[TransactionRead],
    responses={
        409: {
            "model": TransactionClearConflict,
            "description": "Transactions are not clearable",
        }
    },
)
def clears(
    *, session: Session = Depends(get_session), clears: Sequence[TransactionClear]
) -> Sequence[TransactionBase]:
    # Lock the rows here so validation and the write see the same state.
    try:
        errors = validate_transactions_clearable(
            session, [clear.transaction_id for clear in clears], for_update=True
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=err.args[0]) from err
    if any(errors.values()):
        raise HTTPException(
            status_code=409,
            detail={
                txn_id: [error.model_dump(mode="json") for error in txn_errors]
                for txn_id, txn_errors in errors.items()
                if txn_errors
            },
        )
    updates = [
        TransactionStatusUpdate(id=clear.transaction_id, cleared_at=clear.cleared_at)
        for clear in clears
    ]
    try:
        return update_transactions_with_balances(session, updates)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err


@txn_router.patch(
    "",
    name="Update Transactions",
    response_model=list[TransactionRead],
    responses={409: {"description": "Transaction or event is cleared"}},
)
def updates(
    *,
    session: Session = Depends(get_session),
    transactions: Sequence[TransactionUpdate],
) -> Sequence[TransactionBase]:
    try:
        validate_transactions_editable(session, transactions)
    except ValueError as err:
        raise HTTPException(status_code=409, detail=err.args[0]) from err
    try:
        updated = update_transactions_with_balances(session, transactions)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
    return updated
