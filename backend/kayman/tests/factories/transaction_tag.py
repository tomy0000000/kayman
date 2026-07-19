import factory
from factory.alchemy import SQLAlchemyModelFactory

from kayman.schemas import TransactionTag


class TransactionTagFactory(SQLAlchemyModelFactory):
    class Meta:
        model = TransactionTag
        sqlalchemy_session_persistence = "commit"

    # Sequence, not Faker: names must stay unique per the table constraint
    name = factory.Sequence(lambda n: f"tag-{n}")
    archived = False
