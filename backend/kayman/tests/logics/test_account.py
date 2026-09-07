from random import shuffle

import pytest
from sqlmodel import Session

from kayman.crud.account import read_account, read_accounts
from kayman.logics.account import (
    update_accounts_by_ids,
    update_balances_with_transactions,
)
from kayman.schemas.account import Account, AccountUpdate
from kayman.tests.factories import AccountFactory, TransactionFactory


def test_update_accounts_by_ids(session: Session):
    first = AccountFactory(name="first", index=0)
    second = AccountFactory(name="second", index=1)

    updated_accounts = update_accounts_by_ids(
        session,
        [
            AccountUpdate(id=second.id, index=0),
            AccountUpdate(id=first.id, index=1),
        ],
    )

    assert len(updated_accounts) == 2
    assert first.index == 1
    assert second.index == 0
    assert [account.id for account in read_accounts(session)] == [second.id, first.id]


def test_update_accounts_by_ids_empty(session: Session):
    account = AccountFactory(name="untouched")

    assert update_accounts_by_ids(session, []) == []
    assert account.name == "untouched"


def test_update_accounts_by_ids_not_found(session: Session):
    account = AccountFactory(name="first")

    with pytest.raises(ValueError, match="Account id\\(s\\) not found"):
        update_accounts_by_ids(
            session,
            [
                AccountUpdate(id=account.id, index=1),
                AccountUpdate(id=999999, index=0),
            ],
        )


def test_update_accounts_by_ids_no_commit(session: Session, session_2: Session):
    account = AccountFactory(name="first", index=0)

    updated_accounts = update_accounts_by_ids(
        session, [AccountUpdate(id=account.id, index=5)], commit=False
    )

    assert len(updated_accounts) == 1
    assert updated_accounts[0].index == 5

    # Not yet visible to other sessions until commit.
    other = session_2.get(Account, account.id)
    assert other is not None
    assert other.index == 0


def test_update_balances_with_transactions_1_account_1_txn(session: Session):
    account = AccountFactory()
    transaction = TransactionFactory(account=account)
    original_balance = account.balance

    update_balances_with_transactions(session, [transaction])
    db_account = read_account(session, account_id=account.id)

    assert db_account.balance == original_balance + transaction.amount


def test_update_balances_with_transactions_1_account_n_txn(session: Session):
    account = AccountFactory()
    transactions = TransactionFactory.create_batch(10, account=account)
    original_balance = account.balance
    total_amount = sum(txn.amount for txn in transactions)

    update_balances_with_transactions(session, transactions)
    db_account = read_account(session, account_id=account.id)

    assert db_account.balance == original_balance + total_amount


def test_update_balances_with_transactions_n_account_n_txn(session: Session):
    accounts = AccountFactory.create_batch(10)
    original_balances = {account.id: account.balance for account in accounts}
    transactions = []
    total_amounts = {}
    for account in accounts:
        account_transactions = TransactionFactory.create_batch(10, account=account)
        transactions.extend(account_transactions)
        total_amounts[account.id] = sum(txn.amount for txn in account_transactions)

    # Shuffle the transactions
    shuffle(transactions)

    update_balances_with_transactions(session, transactions)

    for account in accounts:
        db_account = read_account(session, account_id=account.id)
        assert (
            db_account.balance
            == original_balances[account.id] + total_amounts[account.id]
        ), f"Account {account.id} balance is not correct"
