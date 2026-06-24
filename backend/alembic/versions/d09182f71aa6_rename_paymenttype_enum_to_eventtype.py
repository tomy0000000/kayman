"""rename paymenttype enum to eventtype

Revision ID: d09182f71aa6
Revises: 7365aeb08d01
Create Date: 2026-06-23 23:26:13.393096

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "d09182f71aa6"
down_revision = "7365aeb08d01"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE paymenttype RENAME TO eventtype")


def downgrade():
    op.execute("ALTER TYPE eventtype RENAME TO paymenttype")
