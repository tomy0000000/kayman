"""rename payment_entry table to event_entry

Revision ID: 0036
Revises: bf73de717801
Create Date: 2026-07-09 23:24:59.528230

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0036"
down_revision = "bf73de717801"
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table("payment_entry", "event_entry")
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "payment_entry_pkey TO event_entry_pkey"
    )
    op.execute("ALTER SEQUENCE payment_entry_id_seq RENAME TO event_entry_id_seq")
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "payment_entry_payment_id_fkey TO event_entry_payment_id_fkey"
    )
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "payment_entry_category_id_fkey TO event_entry_category_id_fkey"
    )
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "fk_payment_entry_currency_code_currency TO fk_event_entry_currency_code_currency"
    )
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "payment_entry_payment_id_index_key TO event_entry_payment_id_index_key"
    )


def downgrade():
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "event_entry_payment_id_index_key TO payment_entry_payment_id_index_key"
    )
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "fk_event_entry_currency_code_currency TO fk_payment_entry_currency_code_currency"
    )
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "event_entry_category_id_fkey TO payment_entry_category_id_fkey"
    )
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "event_entry_payment_id_fkey TO payment_entry_payment_id_fkey"
    )
    op.execute("ALTER SEQUENCE event_entry_id_seq RENAME TO payment_entry_id_seq")
    op.execute(
        "ALTER TABLE event_entry RENAME CONSTRAINT "
        "event_entry_pkey TO payment_entry_pkey"
    )
    op.rename_table("event_entry", "payment_entry")
