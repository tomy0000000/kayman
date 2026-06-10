from random import shuffle

from sqlmodel import Session

from kayman.crud.account import read_account
from kayman.logics.account import update_balances_with_transactions
from kayman.tests.factories import AccountFactory, TransactionFactory


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
