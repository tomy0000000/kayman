from collections.abc import Sequence
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.transaction import create_transactions, get_transactions
from kayman.logics.account import update_balances_with_transactions
from kayman.schemas.transaction import (
    TransactionBase,
    TransactionCreate,
    TransactionRead,
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
    account_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> Sequence[TransactionBase]:
    return get_transactions(session, account_id, start, end)
