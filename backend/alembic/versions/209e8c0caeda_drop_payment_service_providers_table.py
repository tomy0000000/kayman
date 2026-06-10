"""drop payment_service_providers table

Revision ID: 209e8c0caeda
Revises: e9fc0ffafe77
Create Date: 2026-06-09 22:04:17.631447

"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision = "209e8c0caeda"
down_revision = "e9fc0ffafe77"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("payment_service_providers")


def downgrade():
    op.create_table(
        "payment_service_providers",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
