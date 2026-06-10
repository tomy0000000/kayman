from collections.abc import Sequence
from datetime import date

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.openapi.models import Example
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.payment import (
    create_payment,
    read_payment,
    read_payments,
)
from kayman.crud.payment_entry import create_payment_entries
from kayman.crud.transaction import create_transactions
from kayman.logics.account import update_balances_with_transactions
from kayman.logics.payment import validate_total
from kayman.schemas.api_models import PaymentCreateDetailed, PaymentReadDetailed
from kayman.schemas.payment import (
    Payment,
    PaymentBase,
    PaymentEntryBase,
    PaymentRead,
)
from kayman.schemas.transaction import TransactionBase

TAG_NAME = "Payment"
tag = {
    "name": TAG_NAME,
    "description": "Create and edit payment records",
}

payment_router = APIRouter(
    prefix="/payments",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)

EXAMPLES = {
    "create": {
        "Expense": Example(
            {
                "summary": "Expense",
                "value": {
                    "payment": {
                        "type": "Expense",
                        "timestamp": "2022-09-08T08:07:08.000",
                        "timezone": "Asia/Taipei",
                        "description": "Some payment description",
                    },
                    "transactions": [
                        {
                            "account_id": 2,
                            "amount": "-60",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
                        },
                        {
                            "account_id": 3,
                            "amount": "-50",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
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
                    "payment": {
                        "type": "Expense",
                        "timestamp": "2022-09-08T08:07:08.000",
                        "timezone": "Asia/Taipei",
                        "description": "Some payment description",
                    },
                    "transactions": [
                        {
                            "account_id": 2,
                            "amount": "-60",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
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
                    "payment": {
                        "type": "Income",
                        "timestamp": "2022-09-08T08:07:08.000",
                        "timezone": "Asia/Taipei",
                        "description": "Some payment description",
                    },
                    "transactions": [
                        {
                            "account_id": 2,
                            "amount": "50",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
                        },
                        {
                            "account_id": 3,
                            "amount": "60",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
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
                    "payment": {
                        "type": "Transfer",
                        "timestamp": "2022-09-08T08:07:08.000",
                        "timezone": "Asia/Taipei",
                        "description": "Some payment description",
                    },
                    "transactions": [
                        {
                            "account_id": 1,
                            "amount": "-14",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
                        },
                        {
                            "account_id": 2,
                            "amount": "60",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
                        },
                        {
                            "account_id": 3,
                            "amount": "-60",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
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
                    "payment": {
                        "type": "Exchange",
                        "timestamp": "2022-09-08T08:07:08.000",
                        "timezone": "Asia/Taipei",
                        "description": "Some payment description",
                    },
                    "transactions": [
                        {
                            "account_id": 1,
                            "amount": "-150",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
                        },
                        {
                            "account_id": 2,
                            "amount": "-3000",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
                        },
                        {
                            "account_id": 3,
                            "amount": "100",
                            "created_at": "2022-09-08T08:07:08.000",
                            "timezone": "Asia/Taipei",
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


@payment_router.post("", name="Create Payment", response_model=PaymentReadDetailed)
def create(
    *,
    session: Session = Depends(get_session),
    body: PaymentCreateDetailed = Body(openapi_examples=EXAMPLES["create"]),
) -> PaymentBase:
    # Validate total
    try:
        validate_total(body)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=err.args[0]) from err

    # Store payment
    db_payment = create_payment(session, body.payment, commit=False)
    payment_id = PaymentRead.model_validate(db_payment).id

    # Store entries
    entries = []
    for entry_index, entry_create in enumerate(body.entries):
        entries.append(
            PaymentEntryBase.model_validate(
                entry_create,
                update={
                    "payment_id": payment_id,
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
                    "payment_id": payment_id,
                    "index": transaction_index,
                },
            )
        )
    create_transactions(session, transactions, commit=False)

    # Modify account balance
    update_balances_with_transactions(session, body.transactions, commit=False)

    # Read the new payment
    new_payment = read_payment(session, payment_id)
    if new_payment is None:
        raise HTTPException(status_code=500, detail="Failed to create payment")

    # Commit all changes
    session.commit()

    return new_payment


@payment_router.get(
    "/{payment_id}", name="Read Payment", response_model=PaymentReadDetailed
)
def read(*, session: Session = Depends(get_session), payment_id: int) -> PaymentBase:
    payment = read_payment(session, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@payment_router.get("", name="Read Payments", response_model=list[PaymentReadDetailed])
def reads(
    *,
    session: Session = Depends(get_session),
    payment_date: date | None = None,
    category_id: int | None = None,
) -> Sequence[PaymentBase]:
    return read_payments(session, payment_date, category_id)


@payment_router.patch("", name="Update Payment", response_model=PaymentRead)
def update(*, session: Session = Depends(get_session), payment: Payment) -> PaymentBase:
    session.merge(payment)
    session.commit()
    session.refresh(payment)
    return payment


@payment_router.delete("/{id}", name="Delete Payment")
def delete(*, session: Session = Depends(get_session), id: int) -> None:
    payment = session.get(Payment, id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    session.delete(payment)
    session.commit()
