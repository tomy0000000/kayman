from decimal import Decimal

from sqlmodel import Session

from kayman.crud.account import update_account_balances
from kayman.schemas.transaction import TransactionCreate


def update_balances_with_transactions(
    session: Session,
    transactions: list[TransactionCreate],
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
