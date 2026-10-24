from collections import Counter, defaultdict
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal

from sqlmodel import Session

from kayman.crud.account import read_account_balance, update_account_balances
from kayman.crud.statement import read_statements
from kayman.crud.transaction import read_transactions, update_transactions
from kayman.schemas.transaction import (
    Transaction,
    TransactionBill,
    TransactionClear,
    TransactionPost,
    TransactionReadWithBalance,
    TransactionUpdate,
)
from kayman.util import format_ids


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


def _require_transactions(
    session: Session, transaction_ids: Sequence[int], verb: str
) -> dict[int, Transaction]:
    """Raise unless the ids are non-empty, unique, and all exist."""
    # Must precede any read: read_transactions treats an empty id list as "all".
    if not transaction_ids:
        raise ValueError(f"No transactions to {verb}")
    duplicates = {i for i, n in Counter(transaction_ids).items() if n > 1}
    if duplicates:
        raise ValueError(f"Duplicate transaction id(s): {format_ids(duplicates)}")

    txns = {
        txn.id: txn
        for txn in read_transactions(session, transaction_ids=transaction_ids)
        if txn.id is not None
    }
    missing_ids = set(transaction_ids) - txns.keys()
    if missing_ids:
        raise ValueError(f"Transaction id(s) not found: {format_ids(missing_ids)}")
    return txns


def validate_transactions_postable(
    session: Session, posts: Sequence[TransactionPost]
) -> None:
    txns = _require_transactions(
        session, [post.transaction_id for post in posts], "post"
    )
    not_pending = {
        txn_id
        for txn_id, txn in txns.items()
        if txn.posted_at is not None
        or txn.statement_id is not None
        or txn.cleared_at is not None
    }
    if not_pending:
        raise ValueError(f"Transaction id(s) not pending: {format_ids(not_pending)}")


def validate_transactions_clearable(
    session: Session, clears: Sequence[TransactionClear]
) -> None:
    txns = _require_transactions(
        session, [clear.transaction_id for clear in clears], "clear"
    )
    not_posted = {i for i, txn in txns.items() if txn.posted_at is None}
    if not_posted:
        raise ValueError(f"Transaction id(s) not posted: {format_ids(not_posted)}")
    no_statement = {i for i, txn in txns.items() if txn.statement_id is None}
    if no_statement:
        raise ValueError(
            f"Transaction id(s) not on a statement: {format_ids(no_statement)}"
        )
    no_event = {i for i, txn in txns.items() if txn.event_id is None}
    if no_event:
        raise ValueError(
            f"Transaction id(s) have no associated event: {format_ids(no_event)}"
        )
    already_cleared = {i for i, txn in txns.items() if txn.cleared_at is not None}
    if already_cleared:
        raise ValueError(
            f"Transaction id(s) already cleared: {format_ids(already_cleared)}"
        )


def validate_transactions_billable(
    session: Session, bills: Sequence[TransactionBill]
) -> None:
    txns = _require_transactions(
        session, [bill.transaction_id for bill in bills], "bill"
    )
    not_posted = {
        txn.id
        for txn in txns.values()
        if txn.id is not None
        and (
            txn.posted_at is None
            or txn.statement_id is not None
            or txn.cleared_at is not None
        )
    }
    if not_posted:
        raise ValueError(f"Transaction id(s) not posted: {format_ids(not_posted)}")

    statement_ids = {bill.statement_id for bill in bills}
    statements = {
        statement.id: statement
        for statement in read_statements(session, statement_ids=statement_ids)
        if statement.id is not None
    }
    missing_statement_ids = statement_ids - statements.keys()
    if missing_statement_ids:
        raise ValueError(
            f"Statement id(s) not found: {format_ids(missing_statement_ids)}"
        )
    other_account = {
        bill.transaction_id
        for bill in bills
        if txns[bill.transaction_id].account_id
        != statements[bill.statement_id].account_id
    }
    if other_account:
        raise ValueError(
            "Statement does not belong to the account of "
            f"transaction id(s): {format_ids(other_account)}"
        )


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
