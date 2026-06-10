from collections.abc import Sequence
from decimal import Decimal

from sqlmodel import Integer, Session, cast, select

from kayman.schemas.account import Account, AccountBase, AccountCreate, AccountUpdate


def create_account(session: Session, account: AccountCreate) -> AccountBase:
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def read_account(session: Session, account_id: int) -> Account | None:
    return session.get(Account, account_id)


def read_accounts(
    session: Session, account_ids: list[int] | None = None, for_update: bool = False
) -> Sequence[Account]:
    statement = select(Account)
    if account_ids:
        statement = statement.where(cast(Account.id, Integer).in_(account_ids))
    if for_update:
        statement = statement.with_for_update()
    return session.exec(statement).all()


def update_accounts(
    session: Session, account_ids: list[int], accounts: list[AccountUpdate]
) -> Sequence[Account]:
    # Verify account_ids and accounts have the same length
    if len(account_ids) != len(accounts):
        raise ValueError("account_ids and accounts must have the same length")

    # Verify all accounts are valid
    db_accounts = _verify_account_ids(session, account_ids)

    # Update accounts
    for db_account, account in zip(db_accounts, accounts, strict=True):
        account_data = account.model_dump(exclude_unset=True)
        db_account.sqlmodel_update(account_data)

    session.add_all(db_accounts)
    session.commit()

    return read_accounts(session, account_ids)


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
