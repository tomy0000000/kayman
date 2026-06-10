from collections.abc import Sequence

from fastapi import APIRouter, Body, Depends
from fastapi.openapi.models import Example
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.currency import create_currency, read_currencies
from kayman.schemas.currency import Currency

TAG_NAME = "Currency"
tag = {
    "name": TAG_NAME,
    "description": "Create and manage currencies",
}

currency_router = APIRouter(
    prefix="/currencies",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)

EXAMPLES = {
    "create": {
        "United States Dollar": Example(
            {
                "summary": "United States Dollar",
                "value": {"code": "USD", "name": "United States Dollar", "symbol": "$"},
            }
        ),
        "Euro": Example(
            {
                "summary": "Euro",
                "value": {"code": "EUR", "name": "Euro", "symbol": "€"},
            }
        ),
        "British Pound": Example(
            {
                "summary": "British Pound",
                "value": {"code": "GBP", "name": "British Pound", "symbol": "£"},
            }
        ),
        "New Taiwan Dollar": Example(
            {
                "summary": "New Taiwan Dollar",
                "value": {"code": "TWD", "name": "New Taiwan Dollar", "symbol": "NT$"},
            }
        ),
    }
}


@currency_router.post("", name="Create Currency")
def create(
    *,
    session: Session = Depends(get_session),
    currency: Currency = Body(openapi_examples=EXAMPLES["create"]),
) -> Currency:
    return create_currency(session, currency)


@currency_router.get("", name="Read Currencies", response_model=list[Currency])
def reads(*, session: Session = Depends(get_session)) -> Sequence[Currency]:
    return read_currencies(session)
