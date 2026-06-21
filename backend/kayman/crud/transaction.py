from collections.abc import Sequence
from datetime import datetime
from typing import Literal

from sqlmodel import Session, select

from kayman.schemas.transaction import Transaction, TransactionBase

TransactionOrderBy = Literal["created_at", "posted_at", "amount", "id"]


def create_transactions(
    session: Session,
    txns: Sequence[TransactionBase],
    commit: bool = True,
) -> Sequence[TransactionBase]:
    db_txns = [Transaction.model_validate(txn) for txn in txns]
    session.add_all(db_txns)
    if commit:
        session.commit()
        for db_txn in db_txns:
            session.refresh(db_txn)
    else:
        session.flush()
    return db_txns


def get_transactions(
    session: Session,
    account_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    order_by: TransactionOrderBy | None = None,
    descending: bool = False,
) -> Sequence[Transaction]:
    scalar = select(Transaction)
    if account_id:
        scalar = scalar.where(Transaction.account_id == account_id)
    if start is not None:
        scalar = scalar.where(Transaction.created_at >= start)
    if end is not None:
        scalar = scalar.where(Transaction.created_at < end)
    if order_by is not None:
        column = getattr(Transaction, order_by)
        scalar = scalar.order_by(column.desc() if descending else column.asc())
    txns = session.exec(scalar).all()
    return txns
