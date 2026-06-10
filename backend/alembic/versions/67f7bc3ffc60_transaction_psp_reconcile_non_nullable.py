"""Transaction PSP reconcile non nullable

Revision ID: 67f7bc3ffc60
Revises: d750f208cb59
Create Date: 2025-05-23 08:54:49.153178

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = '67f7bc3ffc60'
down_revision = 'd750f208cb59'
branch_labels = None
depends_on = None


def upgrade():
    # Make all reconcile values as False
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE transaction SET psp_reconcile = False"))

    # Make the new column non-nullable
    op.alter_column('transaction', 'psp_reconcile',
               existing_type=sa.BOOLEAN(),
               nullable=False)


def downgrade():
    op.alter_column('transaction', 'psp_reconcile',
               existing_type=sa.BOOLEAN(),
               nullable=True)
