"""rename transaction.payment_id to event_id

Revision ID: 52d7da73b2b4
Revises: d09182f71aa6
Create Date: 2026-06-24 00:00:22.250836

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = '52d7da73b2b4'
down_revision = 'd09182f71aa6'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("transaction", "payment_id", new_column_name="event_id")
    op.execute(
        "ALTER TABLE transaction RENAME CONSTRAINT "
        "transaction_payment_id_index_key TO transaction_event_id_index_key"
    )
    op.execute(
        "ALTER TABLE transaction RENAME CONSTRAINT "
        "transaction_payment_id_fkey TO transaction_event_id_fkey"
    )


def downgrade():
    op.execute(
        "ALTER TABLE transaction RENAME CONSTRAINT "
        "transaction_event_id_fkey TO transaction_payment_id_fkey"
    )
    op.execute(
        "ALTER TABLE transaction RENAME CONSTRAINT "
        "transaction_event_id_index_key TO transaction_payment_id_index_key"
    )
    op.alter_column("transaction", "event_id", new_column_name="payment_id")
