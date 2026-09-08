from collections.abc import Sequence
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.account import read_account
from kayman.crud.statement import create_statements, read_statements
from kayman.schemas.statement import StatementBase, StatementCreate, StatementRead

TAG_NAME = "Statement"
tag = {
    "name": TAG_NAME,
    "description": "Create and manage account statements",
}

statement_router = APIRouter(
    prefix="/statements",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)


@statement_router.post("", name="Create Statement", response_model=StatementRead)
def create(
    *, session: Session = Depends(get_session), statement: StatementCreate
) -> StatementBase:
    if read_account(session, statement.account_id) is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return create_statements(session, [statement])[0]


@statement_router.get("", name="Read Statements", response_model=list[StatementRead])
def reads(
    *,
    session: Session = Depends(get_session),
    statement_id: int | None = None,
    account_id: int | None = None,
    start: date | None = None,
    end: date | None = None,
) -> Sequence[StatementBase]:
    return read_statements(
        session,
        statement_ids=[statement_id] if statement_id is not None else None,
        account_id=account_id,
        start=start,
        end=end,
    )
