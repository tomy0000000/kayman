from sqlmodel import SQLModel


class Client(SQLModel):
    name: str
    password: str


class Token(SQLModel):
    access_token: str
    token_type: str


type Clients = dict[str, Client]
