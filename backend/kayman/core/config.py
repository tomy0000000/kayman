import os
import secrets
from typing import Literal, Self

from pydantic import computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict()
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ENVIRONMENT: Literal["local", "development", "testing", "production"] = "production"

    @model_validator(mode="after")
    def _force_testing_under_pytest(self) -> Self:
        if "PYTEST_VERSION" in os.environ:
            self.ENVIRONMENT = "testing"
        return self

    PROJECT_NAME: str = "Kayman"
    POSTGRES_HOST: str = "kayman-db"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "kayman"
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str = "kayman"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_HOST,
            port=self.POSTGRES_PORT,
            database=self.POSTGRES_DB,
        ).render_as_string(hide_password=False)


settings = Settings()  # type: ignore
