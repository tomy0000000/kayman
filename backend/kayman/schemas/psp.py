from sqlmodel import Field, SQLModel


class PSPBase(SQLModel):
    name: str


class PSP(PSPBase, table=True):
    __tablename__ = "payment_service_providers"
    id: int | None = Field(primary_key=True, default=None)


class PSPCreate(PSPBase):
    pass


class PSPRead(PSPBase):
    id: int
