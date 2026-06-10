import random
import re
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlmodel import Session

from kayman.crud.account import (
    _verify_account_ids,
    create_account,
    read_account,
    read_accounts,
    update_account_balances,
    update_accounts,
)
from kayman.schemas.account import Account
from kayman.tests.factories import AccountFactory


def test_create_account(session: Session):
    account = AccountFactory.build(balance=0)
    db_account = create_account(session, account)

    assert db_account.id is not None
    assert db_account.name == account.name
    assert db_account.currency_code == account.currency_code
    assert db_account.timezone == account.timezone
    assert db_account.balance == 0


def test_read_account(session: Session):
    account = AccountFactory()
    db_account = read_account(session, account.id)

    assert db_account.id == account.id
    assert db_account.name == account.name
    assert db_account.currency_code == account.currency_code
    assert db_account.timezone == account.timezone
    assert db_account.balance == account.balance


def test_read_account_not_found(session: Session):
    assert read_account(session, 1) is None


def test_read_accounts(session: Session):
    accounts = AccountFactory.create_batch(10)
    db_accounts = read_accounts(session)

    assert len(db_accounts) == 10
    for account, db_account in zip(accounts, db_accounts, strict=True):
        assert db_account.balance == account.balance
        assert db_account.currency_code == account.currency_code
        assert db_account.timezone == account.timezone
        assert db_account.id == account.id
        assert db_account.name == account.name


def test_read_accounts_by_ids(session: Session):
    accounts = AccountFactory.create_batch(10)
    interest_accounts = [accounts[index] for index in range(0, 10, 2)]
    db_accounts = read_accounts(session, [account.id for account in interest_accounts])

    assert len(db_accounts) == 5
    for account, db_account in zip(interest_accounts, db_accounts, strict=True):
        assert db_account.balance == account.balance
        assert db_account.currency_code == account.currency_code
        assert db_account.timezone == account.timezone
        assert db_account.id == account.id
        assert db_account.name == account.name


def test_read_accounts_for_update(session: Session):
    AccountFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        read_accounts(session, for_update=True)
        args = mock_exec.call_args[0]
        statement = str(args[0])
        assert "FOR UPDATE" in statement


def test_update_accounts(session: Session):
    accounts = AccountFactory.create_batch(10)
    account_updates = AccountFactory.build_batch(10)

    account_ids = []
    for account, account_update in zip(accounts, account_updates, strict=True):
        account_update.id = account.id
        account_ids.append(account.id)

    updated_accounts = update_accounts(session, account_ids, account_updates)

    for account, account_update, updated_account in zip(
        accounts, account_updates, updated_accounts, strict=True
    ):
        assert updated_account.id == account.id
        assert updated_account.name == account_update.name  # Updated
        assert updated_account.currency_code == account.currency_code  # Not updated
        assert updated_account.timezone == account.timezone  # Not updated
        assert updated_account.balance == account.balance  # Not updated


def test_update_accounts_mismatch_length(session: Session):
    accounts = AccountFactory.create_batch(10)
    account_updates = AccountFactory.build_batch(9)
    account_ids = [account.id for account in accounts]

    with pytest.raises(ValueError, match="must have the same length"):
        update_accounts(session, account_ids, account_updates)


def test_update_account_balances(session: Session):
    accounts = AccountFactory.create_batch(3)
    account_amounts: dict[int, Decimal] = {}
    account_balances: dict[int, Decimal] = {}
    for account in accounts:
        account_amounts[account.id] = Decimal(random.randint(-100, 100))
        account_balances[account.id] = account.balance

    updated_accounts = update_account_balances(session, account_amounts)
    assert len(updated_accounts) == 3

    for account, updated_account in zip(accounts, updated_accounts, strict=True):
        balance = account_balances[account.id]
        amount = account_amounts[account.id]

        assert updated_account.id == account.id
        assert updated_account.name == account.name
        assert updated_account.currency_code == account.currency_code
        assert updated_account.timezone == account.timezone
        assert updated_account.balance == balance + amount


def test_update_account_balances_no_commit(session: Session, session_2: Session):
    account = AccountFactory()
    account_balance = account.balance
    account_amounts: dict[int, Decimal] = {
        account.id: Decimal(random.randint(-100, 100)),
    }

    updated_account = update_account_balances(session, account_amounts, commit=False)[0]
    assert updated_account.id == account.id
    assert updated_account.name == account.name
    assert updated_account.currency_code == account.currency_code
    assert updated_account.timezone == account.timezone
    assert updated_account.balance == account_balance + account_amounts[account.id]

    # The account balance should not be updated from other sessions (yet)
    session_2_account = session_2.get(Account, account.id)
    assert session_2_account.id == account.id
    assert session_2_account.name == account.name
    assert session_2_account.currency_code == account.currency_code
    assert session_2_account.timezone == account.timezone
    assert session_2_account.balance == account_balance

    # Commit the change from main session
    session.commit()
    session_2.reset()

    # The account balance should now be updated from other sessions
    session_2_account = session_2.get(Account, account.id)
    assert session_2_account.id == account.id
    assert session_2_account.name == account.name
    assert session_2_account.currency_code == account.currency_code
    assert session_2_account.timezone == account.timezone
    assert session_2_account.balance == account_balance + account_amounts[account.id]


def test__verify_account_ids(session: Session):
    accounts = AccountFactory.create_batch(10)
    account_ids = [account.id for account in accounts]

    db_accounts = _verify_account_ids(session, account_ids)
    assert len(db_accounts) == 10


def test__verify_account_ids_not_found(session: Session):
    with pytest.raises(ValueError, match=re.escape("Account id(s) not found: {1}")):
        _verify_account_ids(session, [1])
