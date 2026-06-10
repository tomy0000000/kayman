from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException
from pydantic_core import PydanticCustomError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.account import (
    create_account,
    read_account,
    read_accounts,
    update_accounts,
)
from kayman.schemas.account import (
    AccountBase,
    AccountCreate,
    AccountRead,
    AccountUpdate,
)

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
        return create_account(session, account)
    except IntegrityError as err:
        raise PydanticCustomError(
            "currency_not_found",
            f"Currency with code: {account.currency_code} does not exist",
            {"loc": ("body", "currency_code")},
        ) from err


@account_router.get("/{account_id}", name="Read Account", response_model=AccountRead)
def read(*, session: Session = Depends(get_session), account_id: int) -> AccountBase:
    account = read_account(session, account_id)
    if account is None:
        raise PydanticCustomError(
            "account_not_found",
            f"Account with id: {account_id} does not exist",
            {"loc": ("path", "account_id")},
        )
    return account


@account_router.get("", name="Read Accounts", response_model=list[AccountRead])
def reads(*, session: Session = Depends(get_session)) -> Sequence[AccountBase]:
    return read_accounts(session)


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
