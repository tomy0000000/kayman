from collections.abc import Sequence
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic_core import PydanticCustomError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.account import (
    create_accounts,
    read_account,
    read_accounts,
    update_accounts,
)
from kayman.logics.transaction import get_transactions_with_running_balance
from kayman.schemas.account import (
    AccountBase,
    AccountCreate,
    AccountRead,
    AccountUpdate,
)
from kayman.schemas.transaction import TransactionWithBalanceRead

TAG_NAME = "Account"
tag = {
    "name": TAG_NAME,
    "description": "Create and manage accounts",
}

account_router = APIRouter(
    prefix="/accounts",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)


@account_router.post("", name="Create Account", response_model=AccountRead)
def create(
    *, session: Session = Depends(get_session), account: AccountCreate
) -> AccountBase:
    try:
        return create_accounts(session, [account])[0]
    except IntegrityError as err:
        raise PydanticCustomError(
            "currency_not_found",
            "Currency does not exist",
            {"loc": ("body", "currency_code")},
        ) from err


@account_router.get("/{account_id}", name="Read Account", response_model=AccountRead)
def read(*, session: Session = Depends(get_session), account_id: int) -> AccountBase:
    account = read_account(session, account_id)
    if account is None:
        raise PydanticCustomError(
            "account_not_found",
            "Account does not exist",
            {"loc": ("path", "account_id")},
        )
    return account


@account_router.get("", name="Read Accounts", response_model=list[AccountRead])
def reads(*, session: Session = Depends(get_session)) -> Sequence[AccountBase]:
    return read_accounts(session)


@account_router.get(
    "/{account_id}/transactions",
    name="Read Account Transactions With Running Balance",
    response_model=list[TransactionWithBalanceRead],
)
def read_transactions_with_balance(
    *,
    session: Session = Depends(get_session),
    account_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[TransactionWithBalanceRead]:
    if read_account(session, account_id) is None:
        raise PydanticCustomError(
            "account_not_found",
            "Account does not exist",
            {"loc": ("path", "account_id")},
        )
    return get_transactions_with_running_balance(session, account_id, start, end)


@account_router.patch(
    "/{account_id}", name="Update Account", response_model=AccountRead
)
def update(
    *, session: Session = Depends(get_session), account_id: int, account: AccountUpdate
) -> AccountBase:
    try:
        return update_accounts(session, [account_id], [account])[0]
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
