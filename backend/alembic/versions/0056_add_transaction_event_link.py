"""add transaction event link

Revision ID: 0056
Revises: 0055
Create Date: 2026-11-25 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0056"
down_revision = "0055"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "transaction_event_link",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(), nullable=False),
        sa.Column("index", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transaction.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["event_id"], ["event.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "transaction_id",
            "event_id",
            name="transaction_event_link_transaction_id_event_id_key",
        ),
        sa.UniqueConstraint(
            "event_id", "index", name="transaction_event_link_event_id_index_key"
        ),
    )
    # A link needs a position, so legs without one go after the event's last leg
    op.execute(
        sa.text(
            """
            UPDATE transaction
            SET index = ranked.filled
            FROM (
                SELECT
                    t.id,
                    COALESCE(m.max_index, -1) + ROW_NUMBER() OVER (
                        PARTITION BY t.event_id ORDER BY t.id
                    ) AS filled
                FROM transaction AS t
                LEFT JOIN (
                    SELECT event_id, MAX(index) AS max_index
                    FROM transaction
                    WHERE event_id IS NOT NULL
                    GROUP BY event_id
                ) AS m ON m.event_id = t.event_id
                WHERE t.event_id IS NOT NULL AND t.index IS NULL
            ) AS ranked
            WHERE transaction.id = ranked.id
            """
        )
    )
    # Copy positions as-is: the dual-write shim expects links to mirror transactions
    op.execute(
        sa.text(
            """
            INSERT INTO transaction_event_link
                (transaction_id, event_id, amount, index)
            SELECT id, event_id, amount, index
            FROM transaction
            WHERE event_id IS NOT NULL
            """
        )
    )


def downgrade():
    op.drop_table("transaction_event_link")
