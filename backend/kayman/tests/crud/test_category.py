from sqlmodel import Session

from kayman.crud.category import (
    read_categories,
    read_category_ancestors,
    update_categories,
)
from kayman.schemas.category import Category, CategoryUpdate
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


def test_read_categories_by_ids(session: Session):
    wanted = CategoryFactory(name="Wanted")
    CategoryFactory(name="Unwanted")

    categories = read_categories(session, category_ids=[wanted.id])

    assert len(categories) == 1
    assert categories[0].id == wanted.id


def test_read_categories_by_ids_not_found(session: Session):
    assert read_categories(session, category_ids=[999999]) == []


def test_read_categories_for_update(session: Session):
    category = CategoryFactory(name="Locked")

    categories = read_categories(session, category_ids=[category.id], for_update=True)

    assert len(categories) == 1
    assert categories[0].id == category.id


def test_read_category_ancestors_root(session: Session):
    root = CategoryFactory(name="Root")
    CategoryFactory(name="Child", parent_id=root.id)

    ancestors = read_category_ancestors(session, root.id)

    assert len(ancestors) == 1
    assert ancestors[0].id == root.id


def test_read_category_ancestors_chain(session: Session):
    root = CategoryFactory(name="Root")
    child = CategoryFactory(name="Child", parent_id=root.id)
    grandchild = CategoryFactory(name="Grandchild", parent_id=child.id)
    CategoryFactory(name="Sibling", parent_id=root.id)
    CategoryFactory(name="Unrelated")

    ancestors = read_category_ancestors(session, grandchild.id)

    assert len(ancestors) == 3
    assert {category.id for category in ancestors} == {
        grandchild.id,
        child.id,
        root.id,
    }


def test_read_category_ancestors_terminates_on_cycle(session: Session):
    # The logics guard keeps cycles out of the database, but this query must
    # survive one anyway: it is only bounded by UNION dedup, which a depth
    # column would silently defeat and turn into an infinite recursion.
    first = CategoryFactory(name="Alpha")
    second = CategoryFactory(name="Beta", parent_id=first.id)
    first.parent_id = second.id
    session.commit()

    ancestors = read_category_ancestors(session, second.id)

    assert len(ancestors) == 2
    assert {category.id for category in ancestors} == {first.id, second.id}


def test_update_categories(session: Session):
    first = CategoryFactory(name="Alpha", index=0)
    second = CategoryFactory(name="Beta", index=1)

    updated = update_categories(
        session,
        [first, second],
        [
            CategoryUpdate(id=first.id, index=1),
            CategoryUpdate(id=second.id, index=0),
        ],
    )

    assert len(updated) == 2
    assert first.index == 1
    assert second.index == 0
    assert [category.id for category in read_categories(session)] == [
        second.id,
        first.id,
    ]


def test_update_categories_pairs_by_id_not_row_order(session: Session):
    # read_categories returns (index, name) order, so rows come back reversed
    # relative to the id-ordered updates. Positional pairing would swap them.
    first = CategoryFactory(name="Alpha", index=1)
    second = CategoryFactory(name="Beta", index=0)
    rows = read_categories(session)
    assert [category.id for category in rows] == [second.id, first.id]

    updated = update_categories(
        session,
        rows,
        [
            CategoryUpdate(id=first.id, name="Alpha renamed"),
            CategoryUpdate(id=second.id, name="Beta renamed"),
        ],
    )

    assert len(updated) == 2
    assert first.name == "Alpha renamed"
    assert second.name == "Beta renamed"


def test_update_categories_only_touches_set_fields(session: Session):
    category = CategoryFactory(name="Original", description="Original description")

    updated = update_categories(
        session, [category], [CategoryUpdate(id=category.id, index=3)]
    )

    assert len(updated) == 1
    assert updated[0].index == 3
    assert updated[0].name == "Original"
    assert updated[0].description == "Original description"


def test_update_categories_promotes_to_root(session: Session):
    root = CategoryFactory(name="Root")
    child = CategoryFactory(name="Child", parent_id=root.id)

    # Explicit None is set, so it lands, unlike the omitted parent_id above
    updated = update_categories(
        session, [child], [CategoryUpdate(id=child.id, parent_id=None)]
    )

    assert len(updated) == 1
    assert updated[0].parent_id is None
    assert len(read_categories(session, parent_id="empty")) == 2


def test_update_categories_empty(session: Session):
    assert update_categories(session, [], []) == []


def test_update_categories_no_commit(session: Session, session_2: Session):
    category = CategoryFactory(name="Original", index=0)

    updated = update_categories(
        session, [category], [CategoryUpdate(id=category.id, index=5)], commit=False
    )

    assert len(updated) == 1
    assert updated[0].index == 5

    # Not yet visible to other sessions until commit.
    other = session_2.get(Category, category.id)
    assert other is not None
    assert other.index == 0
