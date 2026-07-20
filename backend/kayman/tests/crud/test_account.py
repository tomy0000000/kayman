import random
import re
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlmodel import Session

from kayman.crud.account import (
    _verify_account_ids,
    create_accounts,
    read_account,
    read_account_balance,
    read_accounts,
    update_account_balances,
    update_accounts,
)
from kayman.schemas.account import Account, AccountCreate
from kayman.schemas.currency import Currency
from kayman.tests.factories import AccountFactory, TransactionFactory


def assert_account_matches(
    actual: Account,
    expected: Account | AccountCreate,
    *,
    balance: Decimal | int | None = None,
) -> None:
    """Assert a persisted account matches ``expected``."""
    assert actual.name == expected.name
    assert actual.currency_code == expected.currency_code
    assert actual.timezone == expected.timezone

    # id should be
    # - the expected id for existing accounts
    # - a server-assigned id for new accounts
    if isinstance(expected, Account):
        assert actual.id == expected.id
        assert actual.created_at == expected.created_at
    else:
        assert actual.id is not None
        assert actual.created_at is not None

    # balance should be
    # - 0 for new accounts
    # - the expected balance for existing accounts
    # - a custom balance if provided (e.g. a post-update value)
    if balance is None:
        balance = expected.balance if isinstance(expected, Account) else 0
    assert actual.balance == balance


def test_create_accounts_1_account(
    session: Session, session_2: Session, currency: Currency
):
    account = AccountCreate.model_validate(
        AccountFactory.build(currency_code=currency.code)
    )
    db_account = create_accounts(session, [account])[0]
    db_read_account = read_account(session_2, db_account.id)

    assert_account_matches(db_read_account, account)


def test_create_accounts_n_accounts(session: Session, currency: Currency):
    accounts = [
        AccountCreate.model_validate(account)
        for account in AccountFactory.build_batch(10, currency_code=currency.code)
    ]
    db_accounts = create_accounts(session, accounts)

    assert len(db_accounts) == 10
    for db_account, account in zip(db_accounts, accounts, strict=True):
        assert_account_matches(db_account, account)


def test_create_accounts_empty(session: Session):
    assert create_accounts(session, []) == []


def test_create_accounts_no_commit(
    session: Session, session_2: Session, currency: Currency
):
    account = AccountCreate.model_validate(
        AccountFactory.build(currency_code=currency.code)
    )

    # The account should be created in the session
    session_account = create_accounts(session, [account], commit=False)[0]
    assert_account_matches(session_account, account)

    # The account should not be visible to other sessions (yet)
    assert read_account(session_2, session_account.id) is None

    # Commit the account from main session
    session.commit()

    # The account should now be visible to other sessions
    session_2_account = read_account(session_2, session_account.id)
    assert session_2_account is not None
    assert_account_matches(session_2_account, session_account)


def test_read_account(session: Session):
    account = AccountFactory()
    db_account = read_account(session, account.id)

    assert_account_matches(db_account, account)


def test_read_account_not_found(session: Session):
    assert read_account(session, 1) is None


def test_read_account_balance_empty_account(session: Session):
    account = AccountFactory()

    assert read_account_balance(session, account.id) == Decimal(0)


def test_read_account_balance_nonexistent_account(session: Session):
    assert read_account_balance(session, 9999) == Decimal(0)


def test_read_account_balance_sums_all_txns_when_at_is_none(session: Session):
    account = AccountFactory()
    TransactionFactory(
        account=account,
        amount=Decimal("10.50"),
        created_at=datetime(2026, 1, 5, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("-3.25"),
        created_at=datetime(2026, 2, 1, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("7"),
        created_at=datetime(2026, 3, 1, tzinfo=UTC),
    )

    assert read_account_balance(session, account.id) == Decimal("14.25")


def test_read_account_balance_at_includes_only_txns_before_cutoff(session: Session):
    account = AccountFactory()
    TransactionFactory(
        account=account,
        amount=Decimal("100"),
        created_at=datetime(2025, 12, 1, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("50"),
        created_at=datetime(2025, 12, 31, tzinfo=UTC),
    )
    TransactionFactory(
        account=account,
        amount=Decimal("999"),
        created_at=datetime(2026, 2, 1, tzinfo=UTC),
    )

    assert read_account_balance(
        session, account.id, at=datetime(2026, 1, 1, tzinfo=UTC)
    ) == Decimal("150")


def test_read_account_balance_at_is_exclusive(session: Session):
    account = AccountFactory()
    cutoff = datetime(2026, 1, 1, tzinfo=UTC)
    TransactionFactory(
        account=account,
        amount=Decimal("5"),
        created_at=datetime(2025, 12, 31, tzinfo=UTC),
    )
    TransactionFactory(account=account, amount=Decimal("10"), created_at=cutoff)

    assert read_account_balance(session, account.id, at=cutoff) == Decimal("5")


def test_read_account_balance_isolates_account(session: Session):
    account_a = AccountFactory()
    account_b = AccountFactory()
    TransactionFactory(
        account=account_a,
        amount=Decimal("10"),
        created_at=datetime(2026, 1, 5, tzinfo=UTC),
    )
    TransactionFactory(
        account=account_b,
        amount=Decimal("999"),
        created_at=datetime(2026, 1, 5, tzinfo=UTC),
    )

    assert read_account_balance(session, account_a.id) == Decimal("10")


def test_read_accounts(session: Session):
    accounts = AccountFactory.create_batch(10)
    db_accounts = read_accounts(session)

    assert len(db_accounts) == 10
    for account, db_account in zip(accounts, db_accounts, strict=True):
        assert_account_matches(db_account, account)


def test_read_accounts_by_ids(session: Session):
    accounts = AccountFactory.create_batch(10)
    interest_accounts = [accounts[index] for index in range(0, 10, 2)]
    db_accounts = read_accounts(session, [account.id for account in interest_accounts])

    assert len(db_accounts) == 5
    for account, db_account in zip(interest_accounts, db_accounts, strict=True):
        assert_account_matches(db_account, account)


def test_read_accounts_for_update(session: Session):
    AccountFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        read_accounts(session, for_update=True)
        args = mock_exec.call_args[0]
        statement = str(args[0])
        assert "FOR UPDATE" in statement


def test_update_accounts(session: Session):
    accounts = AccountFactory.create_batch(10)
    account_updates = [
        AccountFactory.build(currency_code=account.currency_code)
        for account in accounts
    ]

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

        assert_account_matches(updated_account, account, balance=balance + amount)


def test_update_account_balances_no_commit(session: Session, session_2: Session):
    account = AccountFactory()
    account_balance = account.balance
    account_amounts: dict[int, Decimal] = {
        account.id: Decimal(random.randint(-100, 100)),
    }

    updated_account = update_account_balances(session, account_amounts, commit=False)[0]
    assert_account_matches(
        updated_account,
        account,
        balance=account_balance + account_amounts[account.id],
    )

    # The account balance should not be updated from other sessions (yet)
    session_2_account = session_2.get(Account, account.id)
    assert_account_matches(session_2_account, account, balance=account_balance)

    # Commit the change from main session
    session.commit()
    session_2.reset()

    # The account balance should now be updated from other sessions
    session_2_account = session_2.get(Account, account.id)
    assert_account_matches(
        session_2_account,
        account,
        balance=account_balance + account_amounts[account.id],
    )


def test__verify_account_ids(session: Session):
    accounts = AccountFactory.create_batch(10)
    account_ids = [account.id for account in accounts]

    db_accounts = _verify_account_ids(session, account_ids)
    assert len(db_accounts) == 10


def test__verify_account_ids_not_found(session: Session):
    with pytest.raises(ValueError, match=re.escape("Account id(s) not found: {1}")):
        _verify_account_ids(session, [1])
