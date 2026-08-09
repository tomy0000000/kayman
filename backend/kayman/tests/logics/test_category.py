import pytest
from sqlmodel import Session

from kayman.crud.category import read_categories
from kayman.logics.category import CategoryCycleError, update_categories_by_ids
from kayman.schemas.category import Category, CategoryUpdate
from kayman.tests.factories import CategoryFactory


def test_update_categories_by_ids(session: Session):
    first = CategoryFactory(name="Alpha", index=0)
    second = CategoryFactory(name="Beta", index=1)

    updated = update_categories_by_ids(
        session,
        [
            CategoryUpdate(id=second.id, index=0),
            CategoryUpdate(id=first.id, index=1),
        ],
    )

    assert len(updated) == 2
    assert first.index == 1
    assert second.index == 0
    assert [category.id for category in read_categories(session)] == [
        second.id,
        first.id,
    ]


def test_update_categories_by_ids_empty(session: Session):
    category = CategoryFactory(name="untouched")

    assert update_categories_by_ids(session, []) == []
    assert category.name == "untouched"


def test_update_categories_by_ids_not_found(session: Session):
    category = CategoryFactory(name="Alpha")

    with pytest.raises(ValueError, match="Category id\\(s\\) not found"):
        update_categories_by_ids(
            session,
            [
                CategoryUpdate(id=category.id, index=1),
                CategoryUpdate(id=999999, index=0),
            ],
        )


def test_update_categories_by_ids_no_commit(session: Session, session_2: Session):
    category = CategoryFactory(name="Alpha", index=0)

    updated = update_categories_by_ids(
        session, [CategoryUpdate(id=category.id, index=5)], commit=False
    )

    assert len(updated) == 1
    assert updated[0].index == 5

    # Not yet visible to other sessions until commit.
    other = session_2.get(Category, category.id)
    assert other is not None
    assert other.index == 0


def test_update_categories_by_ids_reparents(session: Session):
    old_parent = CategoryFactory(name="Old Parent")
    new_parent = CategoryFactory(name="New Parent")
    child = CategoryFactory(name="Child", parent_id=old_parent.id)

    updated = update_categories_by_ids(
        session, [CategoryUpdate(id=child.id, parent_id=new_parent.id, index=0)]
    )

    assert len(updated) == 1
    assert updated[0].parent_id == new_parent.id
    assert read_categories(session, parent_id=old_parent.id) == []
    assert len(read_categories(session, parent_id=new_parent.id)) == 1


def test_update_categories_by_ids_promotes_to_root(session: Session):
    root = CategoryFactory(name="Root")
    child = CategoryFactory(name="Child", parent_id=root.id)

    updated = update_categories_by_ids(
        session, [CategoryUpdate(id=child.id, parent_id=None, index=1)]
    )

    assert len(updated) == 1
    assert updated[0].parent_id is None
    assert len(read_categories(session, parent_id="empty")) == 2


def test_update_categories_by_ids_demotes_to_child(session: Session):
    root = CategoryFactory(name="Root")
    other_root = CategoryFactory(name="Other Root")

    updated = update_categories_by_ids(
        session, [CategoryUpdate(id=other_root.id, parent_id=root.id, index=0)]
    )

    assert len(updated) == 1
    assert updated[0].parent_id == root.id
    roots = read_categories(session, parent_id="empty")
    assert len(roots) == 1
    assert roots[0].id == root.id


def test_update_categories_by_ids_leaves_parent_alone_when_omitted(session: Session):
    root = CategoryFactory(name="Root")
    child = CategoryFactory(name="Child", parent_id=root.id)

    updated = update_categories_by_ids(session, [CategoryUpdate(id=child.id, index=2)])

    assert len(updated) == 1
    assert updated[0].parent_id == root.id


def test_update_categories_by_ids_allows_two_parent_changes(session: Session):
    # Moving outsider under child puts a moving node (root) in its ancestor
    # chain, so the fast path defers to the walk, which then has to read
    # child's own parent from the database to keep climbing.
    root = CategoryFactory(name="Root")
    child = CategoryFactory(name="Child", parent_id=root.id)
    outsider = CategoryFactory(name="Outsider")
    new_home = CategoryFactory(name="New Home")

    updated = update_categories_by_ids(
        session,
        [
            CategoryUpdate(id=outsider.id, parent_id=child.id),
            CategoryUpdate(id=root.id, parent_id=new_home.id),
        ],
    )

    assert len(updated) == 2
    assert outsider.parent_id == child.id
    assert root.parent_id == new_home.id


def test_update_categories_by_ids_allows_move_under_freed_descendant(session: Session):
    # root is a stored ancestor of leaf, so moving root under leaf looks like a
    # cycle against the stored tree. It is not: middle is promoted out of the
    # chain in the same batch, leaving root -> leaf -> middle -> None. This is
    # why the "is anything else moving" check has to run before the membership
    # test, not after it.
    root = CategoryFactory(name="Root")
    middle = CategoryFactory(name="Middle", parent_id=root.id)
    leaf = CategoryFactory(name="Leaf", parent_id=middle.id)

    updated = update_categories_by_ids(
        session,
        [
            CategoryUpdate(id=root.id, parent_id=leaf.id),
            CategoryUpdate(id=middle.id, parent_id=None),
        ],
    )

    assert len(updated) == 2
    assert root.parent_id == leaf.id
    assert middle.parent_id is None
    assert leaf.parent_id == middle.id


def test_update_categories_by_ids_rejects_self_parent(session: Session):
    category = CategoryFactory(name="Alpha")

    with pytest.raises(CategoryCycleError, match="own descendants"):
        update_categories_by_ids(
            session, [CategoryUpdate(id=category.id, parent_id=category.id)]
        )

    assert category.parent_id is None


def test_update_categories_by_ids_rejects_descendant_as_parent(session: Session):
    root = CategoryFactory(name="Root")
    child = CategoryFactory(name="Child", parent_id=root.id)
    grandchild = CategoryFactory(name="Grandchild", parent_id=child.id)

    with pytest.raises(CategoryCycleError, match="own descendants") as excinfo:
        update_categories_by_ids(
            session, [CategoryUpdate(id=root.id, parent_id=grandchild.id)]
        )

    # Ids ride as attributes so a handler can bind them as structured fields
    assert excinfo.value.moved_id == root.id
    assert excinfo.value.new_parent_id == grandchild.id
    assert root.parent_id is None


def test_update_categories_by_ids_rejects_cycle_across_two_updates(session: Session):
    # Each move is legal against the current tree. Only the tree the batch would
    # produce contains the cycle, so a pre-update check would let this through.
    first = CategoryFactory(name="Alpha")
    second = CategoryFactory(name="Beta")

    with pytest.raises(CategoryCycleError, match="own descendants"):
        update_categories_by_ids(
            session,
            [
                CategoryUpdate(id=first.id, parent_id=second.id),
                CategoryUpdate(id=second.id, parent_id=first.id),
            ],
        )

    assert first.parent_id is None
    assert second.parent_id is None


def test_update_categories_by_ids_rejects_cycle_it_walks_into(session: Session):
    # Outsider is checked first and its walk runs straight into the alpha/beta
    # cycle without ever meeting itself. Without the seen-set that walk never
    # terminates; the batch is still rejected, just when alpha's turn comes.
    outsider = CategoryFactory(name="Outsider")
    first = CategoryFactory(name="Alpha")
    second = CategoryFactory(name="Beta")

    with pytest.raises(CategoryCycleError, match="own descendants"):
        update_categories_by_ids(
            session,
            [
                CategoryUpdate(id=outsider.id, parent_id=first.id),
                CategoryUpdate(id=first.id, parent_id=second.id),
                CategoryUpdate(id=second.id, parent_id=first.id),
            ],
        )

    assert outsider.parent_id is None


def test_update_categories_by_ids_rejects_unknown_parent(session: Session):
    category = CategoryFactory(name="Alpha")

    with pytest.raises(ValueError, match="Category id\\(s\\) not found"):
        update_categories_by_ids(
            session, [CategoryUpdate(id=category.id, parent_id=999999)]
        )

    assert category.parent_id is None
