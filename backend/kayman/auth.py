import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from loguru import logger

from kayman.core.config import settings
from kayman.schemas.clients import Client, Clients

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
DEV_CLIENTS_DIR = Path(__file__).parent.parent / "instance"
PROD_CLIENTS_DIR = Path("/etc/secrets")
CLIENTS_JSON = "clients.json"


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")


def setup_clients(app: FastAPI) -> None:
    client_dir = DEV_CLIENTS_DIR if app.debug else PROD_CLIENTS_DIR
    CLIENTS_PATH = client_dir / CLIENTS_JSON
    try:
        with open(CLIENTS_PATH) as f:
            raw_clients = json.load(f)
        logger.info(f"Loaded {len(raw_clients)} clients from {CLIENTS_PATH}")
    except FileNotFoundError:
        logger.warning(
            f"Client file not configured, please configure one at {CLIENTS_PATH}"
        )
        raw_clients = {}
    clients = {client["name"]: Client(**client) for client in raw_clients}
    app.state.clients = clients


def get_clients(request: Request) -> Clients:
    return cast(Clients, request.app.state.clients)


async def get_client(
    token: str = Depends(oauth2_scheme), clients: Clients = Depends(get_clients)
) -> Client:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        client_name = payload.get("sub")
        if client_name is None:
            raise credentials_exception
    except JWTError as err:
        raise credentials_exception from err
    client = clients.get(client_name)
    if not client:
        raise credentials_exception
    return client


def authenticate_client(
    name: str, password: str, clients: dict[str, Client]
) -> Client | None:
    client = clients.get(name)
    if not client:
        return None
    if client.password != password:
        return None
    return client


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
) -> str:
    to_encode = data.copy()
    to_encode.update({"exp": datetime.now(UTC) + expires_delta})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
