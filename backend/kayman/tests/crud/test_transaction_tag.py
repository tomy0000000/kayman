from unittest.mock import patch

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from kayman.crud.transaction_tag import (
    create_transaction_tags,
    read_transaction_tags,
    update_transaction_tags,
)
from kayman.schemas.transaction_tag import (
    TransactionTag,
    TransactionTagCreate,
    TransactionTagUpdate,
)
from kayman.tests.factories import TransactionTagFactory


def test_create_transaction_tags(session: Session):
    tags = [
        TransactionTagCreate.model_validate(tag)
        for tag in TransactionTagFactory.build_batch(3)
    ]
    db_tags = create_transaction_tags(session, tags)

    assert len(db_tags) == 3
    for db_tag, tag in zip(db_tags, tags, strict=True):
        assert db_tag.id is not None
        assert db_tag.name == tag.name
        assert db_tag.color == tag.color
        assert db_tag.archived == tag.archived


def test_create_transaction_tags_empty(session: Session):
    assert create_transaction_tags(session, []) == []


def test_create_transaction_tags_without_color(session: Session):
    db_tag = create_transaction_tags(session, [TransactionTagCreate(name="no-color")])[
        0
    ]

    assert db_tag.color is None


@pytest.mark.parametrize(
    "color",
    ["red", "#ff", "#GGGGGG", "4f46e5", "#4f46e55"],
    ids=["name", "too-short", "non-hex", "no-hash", "too-long"],
)
def test_create_transaction_tags_invalid_color(color):
    with pytest.raises(ValidationError):
        TransactionTagCreate(name="bad-color", color=color)


def test_create_transaction_tags_no_commit(session: Session, session_2: Session):
    tag = TransactionTagCreate.model_validate(TransactionTagFactory.build())

    # The tag should be created in the session
    session_tag = create_transaction_tags(session, [tag], commit=False)[0]
    assert session_tag.id is not None  # Auto int should be set
    assert session_tag.name == tag.name
    assert session_tag.color == tag.color
    assert session_tag.archived == tag.archived

    # The tag should not be visible to other sessions (yet)
    assert session_2.get(TransactionTag, session_tag.id) is None

    # Commit the tag from main session
    session.commit()

    # The tag should now be visible to other sessions
    session_2_tag = session_2.get(TransactionTag, session_tag.id)
    assert session_2_tag is not None
    assert session_2_tag.name == tag.name
    assert session_2_tag.color == tag.color
    assert session_2_tag.archived == tag.archived


def test_create_transaction_tags_duplicate_name(session: Session):
    existing = TransactionTagFactory()

    with pytest.raises(IntegrityError):
        create_transaction_tags(session, [TransactionTagCreate(name=existing.name)])


def test_read_transaction_tags_all(session: Session):
    TransactionTagFactory.create_batch(10)

    assert len(read_transaction_tags(session)) == 10


def test_read_transaction_tags_by_ids(session: Session):
    tag_1 = TransactionTagFactory()
    tag_2 = TransactionTagFactory()
    TransactionTagFactory()

    single = read_transaction_tags(session, transaction_tag_ids=[tag_1.id])
    assert len(single) == 1
    assert single[0].id == tag_1.id

    multiple = read_transaction_tags(session, transaction_tag_ids=[tag_1.id, tag_2.id])
    assert len(multiple) == 2
    assert {tag.id for tag in multiple} == {tag_1.id, tag_2.id}


@pytest.mark.parametrize(
    ("archived", "expected"),
    [
        (True, "archived"),
        (False, "unarchived"),
        (None, "both"),
    ],
    ids=["archived", "unarchived", "both"],
)
def test_read_transaction_tags_by_archived(session: Session, archived, expected):
    archived_tags = TransactionTagFactory.create_batch(2, archived=True)
    unarchived_tags = TransactionTagFactory.create_batch(3, archived=False)
    expected_ids = {
        "archived": {tag.id for tag in archived_tags},
        "unarchived": {tag.id for tag in unarchived_tags},
        "both": {tag.id for tag in archived_tags + unarchived_tags},
    }[expected]

    results = read_transaction_tags(session, archived=archived)

    assert len(results) == len(expected_ids)
    assert {tag.id for tag in results} == expected_ids


def test_read_transaction_tags_for_update(session: Session):
    tag = TransactionTagFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        results = read_transaction_tags(session, for_update=True)
        args = mock_exec.call_args[0]
        statement = str(args[0])
        assert "FOR UPDATE" in statement

    assert len(results) == 1
    assert results[0].id == tag.id


@pytest.mark.parametrize(
    ("field", "new_value"),
    [
        ("name", "renamed-tag"),
        ("color", "#4f46e5"),
        ("archived", True),
    ],
    ids=["name", "color", "archived"],
)
def test_update_transaction_tag_field(session: Session, field, new_value):
    tag = TransactionTagFactory(archived=False)
    originals = {"name": tag.name, "color": tag.color, "archived": tag.archived}

    updated = update_transaction_tags(
        session, [tag.id], [TransactionTagUpdate(**{field: new_value})]
    )

    assert len(updated) == 1
    assert getattr(updated[0], field) == new_value
    # Every field the caller did not set must be left untouched.
    for other_field, original_value in originals.items():
        if other_field == field:
            continue
        assert getattr(updated[0], other_field) == original_value


def test_update_transaction_tags_unarchive(session: Session):
    tag = TransactionTagFactory(archived=True)
    original_name = tag.name

    updated = update_transaction_tags(
        session, [tag.id], [TransactionTagUpdate(archived=False)]
    )

    assert len(updated) == 1
    assert updated[0].archived is False
    assert updated[0].name == original_name


def test_update_transaction_tags_length_mismatch(session: Session):
    tag = TransactionTagFactory()

    with pytest.raises(ValueError, match="same length"):
        update_transaction_tags(session, [tag.id], [])


def test_update_transaction_tags_missing_id(session: Session):
    tag = TransactionTagFactory(name="original")
    missing_id = tag.id + 1000

    with pytest.raises(ValueError, match="not found"):
        update_transaction_tags(
            session,
            [tag.id, missing_id],
            [
                TransactionTagUpdate(name="renamed"),
                TransactionTagUpdate(name="never applied"),
            ],
        )

    # Nothing should have been mutated
    session.rollback()
    db_tags = read_transaction_tags(session, transaction_tag_ids=[tag.id])
    assert len(db_tags) == 1
    assert db_tags[0].name == "original"


def test_update_transaction_tags_no_commit(session: Session, session_2: Session):
    tag = TransactionTagFactory(name="original")

    # The update should be applied in the session
    session_tags = update_transaction_tags(
        session,
        [tag.id],
        [TransactionTagUpdate(name="renamed")],
        commit=False,
    )
    assert len(session_tags) == 1
    assert session_tags[0].name == "renamed"

    # The update should not be visible to other sessions (yet)
    session_2_tag = session_2.get(TransactionTag, tag.id)
    assert session_2_tag.name == "original"

    # Commit the update from main session
    session.commit()

    # The update should now be visible to other sessions
    session_2.expire_all()  # drop session_2's identity-map snapshot
    session_2_tag = session_2.get(TransactionTag, tag.id)
    assert session_2_tag.name == "renamed"
