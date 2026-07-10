from collections.abc import Sequence
from datetime import date

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.openapi.models import Example
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.event import (
    create_events,
    read_event,
    read_events,
)
from kayman.crud.payment_entry import create_payment_entries
from kayman.crud.transaction import create_transactions
from kayman.logics.account import update_balances_with_transactions
from kayman.logics.event import validate_total
from kayman.schemas.api_models import EventCreateDetailed, EventReadDetailed
from kayman.schemas.event import (
    Event,
    EventBase,
    EventCreate,
    EventEntryBase,
    EventRead,
)
from kayman.schemas.transaction import TransactionBase

TAG_NAME = "Event"
tag = {
    "name": TAG_NAME,
    "description": "Create and edit event records",
}

event_router = APIRouter(
    prefix="/events",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)


@event_router.post("", name="Create Event", response_model=EventRead)
def create(*, session: Session = Depends(get_session), event: EventCreate) -> EventBase:
    return create_events(session, [event])[0]


EXAMPLES = {
    "create": {
        "Expense": Example(
            {
                "summary": "Expense",
                "value": {
                    "event": {
                        "type": "Expense",
                        "timestamp": "2022-09-08T08:07:08.000",
                        "timezone": "Asia/Taipei",
                        "description": "Some event description",
                    },
                    "transactions": [
                        {
                            "account_id": 2,
                            "amount": "-60",
                            "created_at": "2022-09-08T08:07:08.000",
                        },
                        {
                            "account_id": 3,
                            "amount": "-50",
                            "created_at": "2022-09-08T08:07:08.000",
                        },
                    ],
                    "entries": [
                        {
                            "category_id": 1,
                            "amount": "20",
                            "quantity": 2,
                            "currency_code": "TWD",
                            "description": "First entry",
                        },
                        {
                            "category_id": 2,
                            "amount": "30",
                            "quantity": 2,
                            "currency_code": "TWD",
                            "description": "Second entry",
                        },
                        {
                            "category_id": 3,
                            "amount": "10",
                            "quantity": 1,
                            "currency_code": "TWD",
                            "description": "Third entry",
                        },
                    ],
                },
            }
        ),
        "Multi-currency Expense": Example(
            {
                "summary": "Multi-currency Expense",
                "value": {
                    "event": {
                        "type": "Expense",
                        "timestamp": "2022-09-08T08:07:08.000",
                        "timezone": "Asia/Taipei",
                        "description": "Some event description",
                    },
                    "transactions": [
                        {
                            "account_id": 2,
                            "amount": "-60",
                            "created_at": "2022-09-08T08:07:08.000",
                        }
                    ],
                    "entries": [
                        {
                            "category_id": 1,
                            "amount": "100",
                            "quantity": 2,
                            "currency_code": "USD",
                        },
                        {
                            "category_id": 1,
                            "amount": "20",
                            "quantity": 1,
                            "currency_code": "TWD",
                        },
                    ],
                },
            }
        ),
        "Income": Example(
            {
                "summary": "Income",
                "value": {
                    "event": {
                        "type": "Income",
                        "timestamp": "2022-09-08T08:07:08.000",
                        "timezone": "Asia/Taipei",
                        "description": "Some event description",
                    },
                    "transactions": [
                        {
                            "account_id": 2,
                            "amount": "50",
                            "created_at": "2022-09-08T08:07:08.000",
                        },
                        {
                            "account_id": 3,
                            "amount": "60",
                            "created_at": "2022-09-08T08:07:08.000",
                        },
                    ],
                    "entries": [
                        {
                            "category_id": 1,
                            "amount": "20",
                            "quantity": 2,
                            "currency_code": "TWD",
                            "description": "First entry",
                        },
                        {
                            "category_id": 2,
                            "amount": "30",
                            "quantity": 2,
                            "currency_code": "TWD",
                            "description": "Second entry",
                        },
                        {
                            "category_id": 3,
                            "amount": "10",
                            "quantity": 1,
                            "currency_code": "TWD",
                            "description": "Third entry",
                        },
                    ],
                },
            }
        ),
        "Transfer with fee": Example(
            {
                "summary": "Transfer with fee",
                "value": {
                    "event": {
                        "type": "Transfer",
                        "timestamp": "2022-09-08T08:07:08.000",
                        "timezone": "Asia/Taipei",
                        "description": "Some event description",
                    },
                    "transactions": [
                        {
                            "account_id": 1,
                            "amount": "-14",
                            "created_at": "2022-09-08T08:07:08.000",
                        },
                        {
                            "account_id": 2,
                            "amount": "60",
                            "created_at": "2022-09-08T08:07:08.000",
                        },
                        {
                            "account_id": 3,
                            "amount": "-60",
                            "created_at": "2022-09-08T08:07:08.000",
                        },
                    ],
                    "entries": [
                        {
                            "category_id": 4,
                            "amount": "14",
                            "quantity": 1,
                            "currency_code": "TWD",
                            "description": "Fee",
                        },
                    ],
                },
            }
        ),
        "Exchange currency with fee": Example(
            {
                "summary": "Exchange currency with fee",
                "value": {
                    "event": {
                        "type": "Exchange",
                        "timestamp": "2022-09-08T08:07:08.000",
                        "timezone": "Asia/Taipei",
                        "description": "Some event description",
                    },
                    "transactions": [
                        {
                            "account_id": 1,
                            "amount": "-150",
                            "created_at": "2022-09-08T08:07:08.000",
                        },
                        {
                            "account_id": 2,
                            "amount": "-3000",
                            "created_at": "2022-09-08T08:07:08.000",
                        },
                        {
                            "account_id": 3,
                            "amount": "100",
                            "created_at": "2022-09-08T08:07:08.000",
                        },
                    ],
                    "entries": [
                        {
                            "category_id": 4,
                            "amount": "150",
                            "quantity": 1,
                            "currency_code": "TWD",
                            "description": "Fee",
                        },
                    ],
                },
            }
        ),
    }
}


@event_router.post(
    "/legacy",
    name="Create Event (Legacy)",
    response_model=EventReadDetailed,
    deprecated=True,
)
def legacy_create(
    *,
    session: Session = Depends(get_session),
    body: EventCreateDetailed = Body(openapi_examples=EXAMPLES["create"]),
) -> EventBase:
    # Validate total
    try:
        validate_total(body)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=err.args[0]) from err

    # Store event
    db_event = create_events(session, [body.event], commit=False)
    event_id = EventRead.model_validate(db_event[0]).id

    # Store entries
    entries = []
    for entry_index, entry_create in enumerate(body.entries):
        entries.append(
            EventEntryBase.model_validate(
                entry_create,
                update={
                    "payment_id": event_id,
                    "index": entry_index,
                },
            )
        )
    create_payment_entries(session, entries, commit=False)

    # Store Transactions
    transactions = []
    for transaction_index, transaction in enumerate(body.transactions):
        transactions.append(
            TransactionBase.model_validate(
                transaction,
                update={
                    "event_id": event_id,
                    "index": transaction_index,
                },
            )
        )
    create_transactions(session, transactions, commit=False)

    # Modify account balance
    update_balances_with_transactions(session, body.transactions, commit=False)

    # Read the new event
    new_event = read_event(session, event_id)
    if new_event is None:
        raise HTTPException(status_code=500, detail="Failed to create event")

    # Commit all changes
    session.commit()

    return new_event


@event_router.get("/{event_id}", name="Read Event", response_model=EventReadDetailed)
def read(*, session: Session = Depends(get_session), event_id: int) -> EventBase:
    event = read_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@event_router.get("", name="Read Events", response_model=list[EventReadDetailed])
def reads(
    *,
    session: Session = Depends(get_session),
    event_date: date | None = None,
    category_id: int | None = None,
) -> Sequence[EventBase]:
    return read_events(session, event_date, category_id)


@event_router.patch("", name="Update Event", response_model=EventRead)
def update(*, session: Session = Depends(get_session), event: Event) -> EventBase:
    session.merge(event)
    session.commit()
    session.refresh(event)
    return event


@event_router.delete("/{id}", name="Delete Event")
def delete(*, session: Session = Depends(get_session), id: int) -> None:
    event = session.get(Event, id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    session.delete(event)
    session.commit()
