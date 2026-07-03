from datetime import datetime
from decimal import Decimal

from sqlmodel import Session

from kayman.crud.account import read_account_balance
from kayman.crud.transaction import get_transactions
from kayman.schemas.transaction import TransactionReadWithBalance


def get_transactions_with_running_balance(
    session: Session,
    account_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[TransactionReadWithBalance]:
    opening = (
        read_account_balance(session, account_id, at=start)
        if start is not None
        else Decimal(0)
    )
    txns = get_transactions(session, account_id, start, end, order_by="created_at")
    running = opening
    results: list[TransactionReadWithBalance] = []
    for txn in txns:
        running += txn.amount
        results.append(
            TransactionReadWithBalance.model_validate(
                txn, update={"running_balance": running}
            )
        )
    return results
