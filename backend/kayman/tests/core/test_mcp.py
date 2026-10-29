import asyncio
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport
from sqlmodel import Session

import kayman.util
from kayman.auth import create_access_token, get_client
from kayman.core.db import get_session
from kayman.main import app, mcp
from kayman.schemas import Currency
from kayman.schemas.clients import Client as ApiClient


def test_tools_exclude_plumbing_admin_and_deletes() -> None:
    async def list_names() -> set[str]:
        async with Client(mcp) as client:
            return {tool.name for tool in await client.list_tools()}

    names = asyncio.run(list_names())

    assert {
        "Read_Accounts",
        "Read_Transactions",
        "Create_Event",
        "Post_Transactions",
        "Bill_Transactions",
        "Clear_Transactions",
        "Clear_Event",
        "Create_Statement",
    } <= names
    assert not names & {
        "Ping",
        "Login",
        "Check_Credential",
        "Delete_Event",
        "Delete_Event_Entries",
        "Create_Account",
        "Update_Accounts",
        "Create_Currency",
        "Create_Category",
        "Update_Categories",
        "Read_Invoices",
    }


def test_endpoint_rejects_requests_without_a_token() -> None:
    response = TestClient(app).post("/mcp", json={"jsonrpc": "2.0", "id": 1})

    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Bearer")


def test_accepts_api_tokens() -> None:
    token = create_access_token({"sub": "mcp"})

    assert asyncio.run(mcp.auth.verify_token(token)) is not None
    assert asyncio.run(mcp.auth.verify_token(token + "x")) is None


def test_tool_call_reaches_the_api(session: Session, currency: Currency) -> None:
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_client] = lambda: ApiClient(name="test", password="")

    async def call() -> list[dict[str, str]]:
        async with Client(mcp) as client:
            result = await client.call_tool("Read_Currencies", {})
            return result.structured_content["result"]

    try:
        rows = asyncio.run(call())
    finally:
        app.dependency_overrides.clear()

    assert [row["code"] for row in rows] == [currency.code]


def test_http_session_forwards_the_bearer_to_the_api(
    monkeypatch: pytest.MonkeyPatch, session: Session, currency: Currency
) -> None:
    monkeypatch.setattr(kayman.util, "alembic_upgrade", lambda: None)
    app.dependency_overrides[get_session] = lambda: session

    def asgi_client(**kwargs: Any) -> httpx2.AsyncClient:
        return httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app), base_url="http://test", **kwargs
        )

    async def call() -> list[dict[str, str]]:
        async with app.router.lifespan_context(app):
            app.state.clients = {"mcp": ApiClient(name="mcp", password="")}
            token = create_access_token({"sub": "mcp"})
            transport = StreamableHttpTransport(
                "http://test/mcp",
                headers={"Authorization": f"Bearer {token}"},
                httpx_client_factory=asgi_client,
            )
            async with Client(transport) as client:
                result = await client.call_tool("Read_Currencies", {})
                return result.structured_content["result"]

    try:
        rows = asyncio.run(call())
    finally:
        app.dependency_overrides.clear()
        del app.state.clients

    assert [row["code"] for row in rows] == [currency.code]
