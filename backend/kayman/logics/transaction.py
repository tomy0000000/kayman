from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal

from sqlmodel import Session

from kayman.crud.account import read_account_balance, update_account_balances
from kayman.crud.transaction import read_transactions, update_transactions
from kayman.schemas.transaction import (
    Transaction,
    TransactionReadWithBalance,
    TransactionUpdate,
)


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
    txns = read_transactions(
        session, account_id=account_id, start=start, end=end, order_by="created_at"
    )
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


def validate_transaction_has_event(session: Session, transaction_id: int) -> None:
    txns = read_transactions(session, transaction_ids=[transaction_id])
    if len(txns) != 1:
        raise ValueError(f"Transaction id(s) not found: {{{transaction_id}}}")
    if txns[0].event_id is None:
        raise ValueError(f"Transaction {transaction_id} has no associated event")


def update_transactions_with_balances(
    session: Session,
    updates: Sequence[TransactionUpdate],
    commit: bool = True,
) -> Sequence[Transaction]:
    # Pre-sort updates
    updates = sorted(updates, key=lambda update: update.id)

    # Get existing txns
    transaction_ids = {update.id for update in updates}
    txns = read_transactions(
        session,
        transaction_ids=transaction_ids,
        order_by="id",
        for_update=True,
    )
    missing_ids = transaction_ids - {txn.id for txn in txns}
    if missing_ids:
        raise ValueError(f"Transaction id(s) not found: {missing_ids}")

    # Compute deltas for each account
    account_amounts = _calculate_account_deltas(txns, updates)

    # Apply updates to transactions and account balances
    update_transactions(session, txns, updates, commit=False)
    update_account_balances(session, account_amounts, commit=False)

    if commit:
        session.commit()
        for txn in txns:
            session.refresh(txn)
    else:
        session.flush()

    return txns


def _calculate_account_deltas(
    transactions: Sequence[Transaction],
    updates: Sequence[TransactionUpdate],
) -> dict[int, Decimal]:
    # Map account_id -> amount delta. Each update moves its account by only the
    # change between the new amount and the transaction's prior amount. Updates
    # that don't touch the amount leave the balance unchanged.
    account_amounts: dict[int, Decimal] = defaultdict(Decimal)
    for transaction, update in zip(transactions, updates, strict=True):
        if update.amount is None:
            continue
        account_id = transaction.account_id
        account_amounts[account_id] += update.amount - transaction.amount
    return account_amounts
