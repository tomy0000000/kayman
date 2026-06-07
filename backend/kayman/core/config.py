import secrets
from typing import Literal

from pydantic import PostgresDsn, computed_field
from pydantic_core import MultiHostUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="instance/.env",
        env_ignore_empty=True,
        extra="ignore",
    )
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ENVIRONMENT: Literal["local", "staging", "production"] = "production"

    PROJECT_NAME: str = "Kayman"
    POSTGRES_HOST: str = "kayman-db"  # Default Docker Compose service name
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "kayman"
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str = "kayman"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        # FIXME someday
        # pydantic recognize PostgresDsn as MultiHostUrl in 2.9.2, not after that
        return MultiHostUrl.build(  # type: ignore
            scheme="postgresql",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_HOST,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )


settings = Settings()  # type: ignore
