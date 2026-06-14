"""Bind transaction id sequence

Revision ID: 9ef5b1dd411f
Revises: fa34b0989819
Create Date: 2026-06-14 14:48:59.326802

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "9ef5b1dd411f"
down_revision = "fa34b0989819"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            "ALTER TABLE transaction "
            "ALTER COLUMN id SET DEFAULT nextval('transaction_id_seq')"
        )
    )
    op.execute(sa.text("ALTER SEQUENCE transaction_id_seq OWNED BY transaction.id"))
    op.execute(
        sa.text(
            "SELECT setval('transaction_id_seq', "
            "COALESCE((SELECT MAX(id) FROM transaction), 0) + 1, false)"
        )
    )


def downgrade():
    op.execute(sa.text("ALTER SEQUENCE transaction_id_seq OWNED BY NONE"))
    op.execute(sa.text("ALTER TABLE transaction ALTER COLUMN id DROP DEFAULT"))
