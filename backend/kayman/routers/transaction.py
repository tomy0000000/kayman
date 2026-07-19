from collections.abc import Sequence
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.transaction import create_transactions, read_transactions
from kayman.logics.account import update_balances_with_transactions
from kayman.logics.transaction import update_transactions_with_balances
from kayman.schemas.transaction import (
    TransactionBase,
    TransactionCreate,
    TransactionPost,
    TransactionRead,
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


@txn_router.post("", name="Create Transaction", response_model=TransactionRead)
def create(
    *, session: Session = Depends(get_session), transaction: TransactionCreate
) -> TransactionBase:
    db_txns = create_transactions(session, [transaction], commit=False)
    update_balances_with_transactions(session, [transaction], commit=False)
    session.commit()
    session.refresh(db_txns[0])
    return db_txns[0]


@txn_router.get("", name="Read Transactions", response_model=list[TransactionRead])
def reads(
    *,
    session: Session = Depends(get_session),
    transaction_id: int | None = None,
    account_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    event_id: int | Literal["empty"] | None = None,
) -> Sequence[TransactionBase]:
    return read_transactions(
        session,
        transaction_ids=[transaction_id] if transaction_id is not None else None,
        account_id=account_id,
        start=start,
        end=end,
        event_id=event_id,
    )


@txn_router.post(
    "/{transaction_id}/posted",
    name="Post Transaction",
    response_model=TransactionRead,
)
def post(
    *,
    session: Session = Depends(get_session),
    transaction_id: int,
    data: TransactionPost,
) -> TransactionBase:
    update = TransactionUpdate(id=transaction_id, **data.model_dump(exclude_unset=True))
    try:
        updated = update_transactions_with_balances(session, [update])
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
    return updated[0]


@txn_router.patch("", name="Update Transactions", response_model=list[TransactionRead])
def updates(
    *,
    session: Session = Depends(get_session),
    transactions: Sequence[TransactionUpdate],
) -> Sequence[TransactionBase]:
    try:
        updated = update_transactions_with_balances(session, transactions)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
    return updated
