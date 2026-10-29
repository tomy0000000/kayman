import asyncio

import pytest
from fastapi.testclient import TestClient
from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    RefreshToken,
    TokenError,
)
from mcp.shared.auth import OAuthClientInformationFull

from kayman.core.oauth import KaymanOAuthProvider
from kayman.main import app

REDIRECT_URI = "http://localhost:5555/callback"


def test_metadata_points_at_this_origin() -> None:
    client = TestClient(app)

    server = client.get("/.well-known/oauth-authorization-server").json()
    resource = client.get("/.well-known/oauth-protected-resource/mcp").json()

    assert server["authorization_endpoint"] == "http://localhost:8000/authorize"
    assert server["registration_endpoint"] == "http://localhost:8000/register"
    assert resource["resource"] == "http://localhost:8000/mcp"


def _code(**overrides: object) -> AuthorizationCode:
    fields: dict[str, object] = {
        "code": "code",
        "client_id": "client",
        "redirect_uri": REDIRECT_URI,
        "redirect_uri_provided_explicitly": True,
        "scopes": [],
        "expires_at": 4_000_000_000,
        "code_challenge": "challenge",
        "subject": "mcp",
    }
    return AuthorizationCode(**{**fields, **overrides})


def test_exchange_rejects_a_consumed_code() -> None:
    provider: KaymanOAuthProvider = app.state.oauth
    oauth_client = OAuthClientInformationFull(client_id="client", redirect_uris=None)

    with pytest.raises(TokenError, match="already used"):
        asyncio.run(provider.exchange_authorization_code(oauth_client, _code()))


def test_tokens_require_a_logged_in_subject() -> None:
    provider: KaymanOAuthProvider = app.state.oauth
    oauth_client = OAuthClientInformationFull(client_id="client", redirect_uris=None)
    provider.auth_codes["code"] = _code(subject=None)

    with pytest.raises(TokenError, match="no subject"):
        asyncio.run(
            provider.exchange_authorization_code(oauth_client, _code(subject=None))
        )


def test_revoke_forgets_refresh_tokens_only() -> None:
    provider: KaymanOAuthProvider = app.state.oauth
    refresh = RefreshToken(token="refresh", client_id="client", scopes=[])
    provider.refresh_tokens["refresh"] = refresh

    asyncio.run(provider.revoke_token(refresh))
    asyncio.run(
        provider.revoke_token(AccessToken(token="jwt", client_id="c", scopes=[]))
    )

    assert "refresh" not in provider.refresh_tokens
