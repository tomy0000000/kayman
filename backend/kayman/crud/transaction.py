from collections.abc import Sequence

from sqlmodel import Session, select

from kayman.schemas.transaction import Transaction, TransactionBase


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
    session: Session, account_id: int | None = None
) -> Sequence[Transaction]:
    scalar = select(Transaction)
    if account_id:
        scalar = scalar.where(Transaction.account_id == account_id)
    txns = session.exec(scalar).all()
    return txns
