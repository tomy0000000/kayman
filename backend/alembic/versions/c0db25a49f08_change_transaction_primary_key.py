"""Change transaction primary key

Revision ID: c0db25a49f08
Revises: b591254840d9
Create Date: 2025-03-24 06:46:54.994209

"""
import sqlalchemy as sa

from alembic import op
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision = 'c0db25a49f08'
down_revision = 'b591254840d9'
branch_labels = None
depends_on = None


def upgrade():
    # Add the new column as nullable
    op.add_column('transaction', sa.Column('id', sa.Integer(), nullable=True))

    # Create the sequence
    op.execute(sa.text("CREATE SEQUENCE transaction_id_seq"))

    # Generate unique IDs for existing transactions
    connection = op.get_bind()
    connection.execute(text("UPDATE transaction SET id = nextval('transaction_id_seq')"))

    # Make the new column non-nullable
    op.alter_column('transaction', 'id', nullable=False)

    # Drop the old primary key
    op.drop_constraint('transaction_pkey', 'transaction')

    # Make the new column the primary key
    op.create_primary_key('transaction_pkey', 'transaction', ['id'])

def downgrade():
    # Drop the primary key created on the new "id" column
    op.drop_constraint('transaction_pkey', 'transaction', type_='primary')

    # Recreate the old primary key constraint.
    # Replace 'old_primary_key_column' with the actual original primary key column name.
    op.create_primary_key('transaction_pkey', 'transaction', ['account_id', 'payment_id'])

    # Drop the sequence that was created for the new column
    op.execute(sa.text("DROP SEQUENCE transaction_id_seq"))

    # Remove the new "id" column from the table
    op.drop_column('transaction', 'id')
