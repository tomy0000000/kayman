from sqlmodel import Session

from kayman.crud.category import read_categories
from kayman.tests.factories import CategoryFactory


def test_read_categories(session: Session):
    root = CategoryFactory(name="Root")
    child = CategoryFactory(name="Child", parent_id=root.id)

    categories = read_categories(session)

    assert len(categories) == 2
    assert {category.id for category in categories} == {root.id, child.id}


def test_read_categories_empty(session: Session):
    assert read_categories(session) == []


def test_read_categories_roots_only(session: Session):
    root = CategoryFactory(name="Root")
    CategoryFactory(name="Child", parent_id=root.id)

    categories = read_categories(session, parent_id="empty")

    assert len(categories) == 1
    assert categories[0].id == root.id


def test_read_categories_by_parent(session: Session):
    root = CategoryFactory(name="Root")
    other_root = CategoryFactory(name="Other Root")
    child = CategoryFactory(name="Child", parent_id=root.id)
    CategoryFactory(name="Other Child", parent_id=other_root.id)

    categories = read_categories(session, parent_id=root.id)

    assert len(categories) == 1
    assert categories[0].id == child.id


def test_read_categories_ordered_by_index(session: Session):
    last = CategoryFactory(name="Alpha", index=2)
    first = CategoryFactory(name="Zulu", index=0)
    middle = CategoryFactory(name="Mike", index=1)

    categories = read_categories(session)

    assert len(categories) == 3
    assert [category.id for category in categories] == [first.id, middle.id, last.id]


def test_read_categories_ties_broken_by_name(session: Session):
    second = CategoryFactory(name="Beta", index=0)
    first = CategoryFactory(name="Alpha", index=0)

    categories = read_categories(session)

    assert len(categories) == 2
    assert [category.id for category in categories] == [first.id, second.id]
