from collections.abc import Collection, Sequence
from datetime import datetime
from typing import Literal

from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from kayman.schemas.transaction import (
    Transaction,
    TransactionBase,
    TransactionCreate,
    TransactionUpdate,
)

TransactionOrderBy = Literal["created_at", "posted_at", "amount", "id"]


def create_transactions(
    session: Session,
    txns: Sequence[TransactionCreate],
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


def read_transactions(
    session: Session,
    transaction_ids: Collection[int] | None = None,
    account_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    event_id: int | Literal["empty"] | None = None,
    order_by: TransactionOrderBy | None = None,
    descending: bool = False,
    for_update: bool = False,
) -> Sequence[Transaction]:
    scalar = select(Transaction).options(selectinload(Transaction.account))  # type: ignore[arg-type]
    if transaction_ids:
        scalar = scalar.where(col(Transaction.id).in_(transaction_ids))
    if account_id:
        scalar = scalar.where(Transaction.account_id == account_id)
    if event_id == "empty":
        scalar = scalar.where(col(Transaction.event_id).is_(None))
    elif event_id is not None:
        scalar = scalar.where(Transaction.event_id == event_id)
    if start is not None:
        scalar = scalar.where(Transaction.created_at >= start)
    if end is not None:
        scalar = scalar.where(Transaction.created_at < end)
    column = (
        getattr(Transaction, order_by) if order_by is not None else col(Transaction.id)
    )
    scalar = scalar.order_by(column.desc() if descending else column.asc())
    if for_update:
        scalar = scalar.with_for_update()
    txns = session.exec(scalar).all()
    return txns


def update_transactions(
    session: Session,
    previous_txns: Sequence[Transaction],
    updates: Sequence[TransactionUpdate],
    commit: bool = True,
) -> Sequence[Transaction]:
    if len(previous_txns) != len(updates):
        raise ValueError("previous_txns and updates must have the same length")

    for db_txn, txn in zip(previous_txns, updates, strict=True):
        db_txn.sqlmodel_update(txn.model_dump(exclude_unset=True, exclude={"id"}))

    session.add_all(previous_txns)
    if commit:
        session.commit()
        for db_txn in previous_txns:
            session.refresh(db_txn)
    else:
        session.flush()

    return previous_txns
