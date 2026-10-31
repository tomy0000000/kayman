"""scope account index to type

Revision ID: 0055
Revises: 0054
Create Date: 2026-10-31 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0055"
down_revision = "0054"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            """
            UPDATE account
            SET index = ranked.position
            FROM (
                SELECT
                    id,
                    ROW_NUMBER() OVER (PARTITION BY type ORDER BY index, id) - 1
                        AS position
                FROM account
            ) AS ranked
            WHERE account.id = ranked.id
            """
        )
    )


def downgrade():
    # Back to one sequence across all accounts, keeping the grouped order.
    op.execute(
        sa.text(
            """
            UPDATE account
            SET index = ranked.position
            FROM (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        ORDER BY
                            CASE type
                                WHEN 'CREDIT_CARD' THEN 0
                                WHEN 'CASH' THEN 1
                                WHEN 'REWARD' THEN 2
                                WHEN 'INVESTMENT' THEN 3
                            END,
                            index,
                            id
                    ) - 1 AS position
                FROM account
            ) AS ranked
            WHERE account.id = ranked.id
            """
        )
    )
