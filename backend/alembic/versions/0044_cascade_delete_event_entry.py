"""cascade delete event entry

Revision ID: 0044
Revises: 0043
Create Date: 2026-09-05 00:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def upgrade():
    # Hand-written: autogenerate does not compare ON DELETE actions, so the
    # constraint has to be dropped and recreated to pick up the cascade.
    op.drop_constraint("event_entry_event_id_fkey", "event_entry", type_="foreignkey")
    op.create_foreign_key(
        "event_entry_event_id_fkey",
        "event_entry",
        "event",
        ["event_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint("event_entry_event_id_fkey", "event_entry", type_="foreignkey")
    op.create_foreign_key(
        "event_entry_event_id_fkey",
        "event_entry",
        "event",
        ["event_id"],
        ["id"],
    )
