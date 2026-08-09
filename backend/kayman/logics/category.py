from collections.abc import Sequence

from sqlmodel import Session

from kayman.crud.category import (
    read_categories,
    read_category_ancestors,
    update_categories,
)
from kayman.schemas.category import Category, CategoryUpdate


class CategoryCycleError(ValueError):
    """A parent_id change would put a category inside its own subtree.

    A ValueError so it stays compatible with the repo's `except ValueError`
    idiom, but distinct so routers can answer 400 rather than 404.

    The message stays static and the ids ride along as attributes, so a handler
    can bind them as structured fields instead of parsing them back out.
    """

    MESSAGE = "Category cannot be moved under one of its own descendants"

    def __init__(self, moved_id: int, new_parent_id: int) -> None:
        self.moved_id = moved_id
        self.new_parent_id = new_parent_id
        super().__init__(self.MESSAGE)


def update_categories_by_ids(
    session: Session,
    updates: Sequence[CategoryUpdate],
    commit: bool = True,
) -> Sequence[Category]:
    # Nothing to resolve, and an empty id set would read (and lock) every row
    if not updates:
        return []

    category_ids = {update.id for update in updates}
    categories = read_categories(session, category_ids=category_ids, for_update=True)
    missing_ids = category_ids - {category.id for category in categories}
    if missing_ids:
        raise ValueError(f"Category id(s) not found: {missing_ids}")

    _verify_parent_changes(session, updates)

    return update_categories(session, categories, updates, commit=commit)


def _verify_parent_changes(session: Session, updates: Sequence[CategoryUpdate]) -> None:
    """Reject parent moves that would detach a subtree from the roots.

    A category pointed at its own descendant is unreachable, so it and
    everything under it would silently vanish with no error.
    """

    # Consolidate a moves map. `model_dump` here will exclude updates with no moves.
    moves: dict[int, int | None] = {}
    for update in updates:
        data = update.model_dump(exclude_unset=True)
        if "parent_id" in data:
            moves[update.id] = data["parent_id"]
    if not moves:
        return

    # Verify that all new parents exist
    new_parent_ids = {
        parent_id for parent_id in moves.values() if parent_id is not None
    }
    if new_parent_ids:
        found = read_categories(session, category_ids=new_parent_ids)
        missing_ids = new_parent_ids - {category.id for category in found}
        if missing_ids:
            raise ValueError(f"Category id(s) not found: {missing_ids}")

    # Detect cycles
    # A move is a cycle if the moved category is among its own new ancestors.
    for moved_id, new_parent_id in moves.items():
        # Promoting to root can never cycle: roots have no ancestors
        if new_parent_id is None:
            continue

        stored = {
            category.id for category in read_category_ancestors(session, new_parent_id)
        }

        # That query walked the stored tree. If anything else in the chain is
        # also moving, the batch's tree differs from it and the answer cannot be
        # trusted either way, so fall back to a hop-by-hop walk.
        if (stored - {moved_id}) & moves.keys():
            _walk_pending_moves(session, moves, moved_id, new_parent_id)
        elif moved_id in stored:
            raise CategoryCycleError(moved_id, new_parent_id)


def _walk_pending_moves(
    session: Session,
    moves: dict[int, int | None],
    moved_id: int,
    new_parent_id: int,
) -> None:
    """Climb from the new parent, preferring pending moves over stored parents.

    Two moves can each be legal against the stored tree and still form a cycle
    in the tree the batch would produce. Only this walk sees them together.
    """
    seen: set[int] = set()
    cursor: int | None = new_parent_id
    while cursor is not None and cursor not in seen:
        if cursor == moved_id:
            raise CategoryCycleError(moved_id, new_parent_id)
        seen.add(cursor)
        if cursor in moves:
            cursor = moves[cursor]
            continue
        ancestors = read_categories(session, category_ids=[cursor])
        assert len(ancestors) == 1  # parent_id is a verified FK
        cursor = ancestors[0].parent_id
