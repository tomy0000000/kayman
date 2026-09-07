from collections.abc import Sequence
from decimal import Decimal

from sqlmodel import Session

from kayman.crud.account import (
    read_accounts,
    update_account_balances,
    update_accounts,
)
from kayman.schemas.account import Account, AccountUpdate
from kayman.schemas.transaction import TransactionBase


def update_accounts_by_ids(
    session: Session,
    updates: Sequence[AccountUpdate],
    commit: bool = True,
) -> Sequence[Account]:
    # Nothing to resolve, and an empty id set would read (and lock) every row
    if not updates:
        return []

    account_ids = {update.id for update in updates}
    accounts = read_accounts(session, list(account_ids), for_update=True)
    missing_ids = account_ids - {account.id for account in accounts}
    if missing_ids:
        raise ValueError(f"Account id(s) not found: {missing_ids}")

    return update_accounts(session, accounts, updates, commit=commit)


def update_balances_with_transactions(
    session: Session,
    transactions: Sequence[TransactionBase],
    commit: bool = True,
) -> None:
    # Create a map of account_id -> amount
    account_amounts: dict[int, Decimal] = {}
    for transaction in transactions:
        account_id = transaction.account_id
        if account_id not in account_amounts:
            account_amounts[account_id] = Decimal(0)
        account_amounts[account_id] += transaction.amount

    # Update the account balance
    update_account_balances(session, account_amounts, commit=commit)
