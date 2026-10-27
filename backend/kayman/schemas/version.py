from sqlmodel import SQLModel


class VersionRead(SQLModel):
    version: str
    commit: str | None
