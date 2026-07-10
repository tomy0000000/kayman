"""rename event_entry payment_id to event_id

Revision ID: 0037
Revises: 0036
Create Date: 2026-07-09 23:36:46.799048

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("event_entry", "payment_id", new_column_name="event_id")
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "event_entry_payment_id_index_key TO event_entry_event_id_index_key"
    )
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "event_entry_payment_id_fkey TO event_entry_event_id_fkey"
    )


def downgrade():
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "event_entry_event_id_fkey TO event_entry_payment_id_fkey"
    )
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "event_entry_event_id_index_key TO event_entry_payment_id_index_key"
    )
    op.alter_column("event_entry", "event_id", new_column_name="payment_id")
