"""drop transaction event_id constraints

Revision ID: 0057
Revises: 0056
Create Date: 2026-11-26 00:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0057"
down_revision = "0056"
branch_labels = None
depends_on = None


def upgrade():
    # The app stops writing the columns, so a stale event_id must not block event deletes
    op.drop_constraint("transaction_event_id_fkey", "transaction", type_="foreignkey")
    op.drop_constraint("transaction_event_id_index_key", "transaction", type_="unique")


def downgrade():
    # Rebuild both columns from the links, which kept changing after the app stopped
    op.execute(
        'UPDATE "transaction" t SET event_id = NULL, "index" = NULL '
        "WHERE t.event_id IS NOT NULL AND NOT EXISTS ("
        "SELECT 1 FROM transaction_event_link l "
        "WHERE l.transaction_id = t.id AND l.event_id = t.event_id)"
    )
    op.execute(
        'UPDATE "transaction" t SET "index" = l."index" '
        "FROM transaction_event_link l "
        "WHERE l.transaction_id = t.id AND l.event_id = t.event_id"
    )
    op.create_unique_constraint(
        "transaction_event_id_index_key", "transaction", ["event_id", "index"]
    )
    op.create_foreign_key(
        "transaction_event_id_fkey", "transaction", "event", ["event_id"], ["id"]
    )
