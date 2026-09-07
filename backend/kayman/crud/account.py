from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from typing import Literal

from sqlalchemy import func
from sqlmodel import Integer, Session, cast, col, select

from kayman.schemas.account import Account, AccountBase, AccountCreate, AccountUpdate
from kayman.schemas.transaction import Transaction

AccountOrderBy = Literal["name", "balance", "created_at", "id", "index"]


def create_accounts(
    session: Session, accounts: Sequence[AccountCreate], commit: bool = True
) -> Sequence[AccountBase]:
    db_accounts = [Account.model_validate(account) for account in accounts]
    session.add_all(db_accounts)
    if commit:
        session.commit()
        for db_account in db_accounts:
            session.refresh(db_account)
    else:
        session.flush()
    return db_accounts


def read_account(session: Session, account_id: int) -> Account | None:
    return session.get(Account, account_id)


def read_account_balance(
    session: Session, account_id: int, at: datetime | None = None
) -> Decimal:
    scalar = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.account_id == account_id
    )
    if at is not None:
        scalar = scalar.where(Transaction.created_at < at)
    return Decimal(session.exec(scalar).one())


def read_accounts(
    session: Session,
    account_ids: list[int] | None = None,
    order_by: AccountOrderBy | None = None,
    descending: bool = False,
    for_update: bool = False,
) -> Sequence[Account]:
    statement = select(Account)
    if account_ids:
        statement = statement.where(cast(Account.id, Integer).in_(account_ids))
    if order_by is None or order_by == "index":
        columns = [col(Account.index), col(Account.id)]
    else:
        columns = [getattr(Account, order_by)]
    statement = statement.order_by(
        *(column.desc() if descending else column.asc() for column in columns)
    )
    if for_update:
        statement = statement.with_for_update()
    return session.exec(statement).all()


def update_accounts(
    session: Session,
    previous_accounts: Sequence[Account],
    updates: Sequence[AccountUpdate],
    commit: bool = True,
) -> Sequence[Account]:
    # Pair by id, not by row order: read_accounts orders by (index, id), so
    # positional pairing would misassign rows to updates
    id_to_db_account = {account.id: account for account in previous_accounts}
    for update in updates:
        db_account = id_to_db_account[update.id]
        data = update.model_dump(exclude_unset=True, exclude={"id"})
        db_account.sqlmodel_update(data)

    session.add_all(previous_accounts)
    if commit:
        session.commit()
        for db_account in previous_accounts:
            session.refresh(db_account)
    else:
        session.flush()

    return previous_accounts


def update_account_balances(
    session: Session,
    account_amounts: dict[int, Decimal],
    commit: bool = True,
) -> Sequence[Account]:
    account_ids = list(account_amounts.keys())
    db_accounts = _verify_account_ids(session, account_ids)
    id_to_index = {account.id: index for index, account in enumerate(db_accounts)}
    for account_id, amount in account_amounts.items():
        db_account = db_accounts[id_to_index[account_id]]
        db_account.balance += amount

    session.add_all(db_accounts)
    if commit:
        session.commit()
        for account in db_accounts:
            session.refresh(account)
    else:
        session.flush()

    return read_accounts(session, account_ids)


def _verify_account_ids(session: Session, account_ids: list[int]) -> Sequence[Account]:
    db_accounts = read_accounts(session, account_ids, for_update=True)
    missing_ids = set(account_ids) - {account.id for account in db_accounts}
    if missing_ids:
        raise ValueError(f"Account id(s) not found: {missing_ids}")

    return db_accounts
