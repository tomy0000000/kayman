import secrets
import time
from datetime import timedelta
from typing import NamedTuple

from fastmcp.server.auth.providers.in_memory import InMemoryOAuthProvider
from fastmcp.server.auth.providers.jwt import JWTVerifier
from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    RefreshToken,
    TokenError,
    construct_redirect_uri,
)
from mcp.server.auth.settings import ClientRegistrationOptions
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken

from kayman.auth import ALGORITHM, create_access_token
from kayman.core.config import settings

# Short-lived access tokens bound the leak window; clients refresh silently.
ACCESS_TOKEN_EXPIRY = timedelta(minutes=10)
AUTHORIZATION_EXPIRY_SECONDS = 5 * 60
LOGIN_PATH = "/oauth/login"


class PendingAuthorization(NamedTuple):
    client: OAuthClientInformationFull
    params: AuthorizationParams
    expires_at: float


class KaymanOAuthProvider(InMemoryOAuthProvider):
    """OAuth server that logs in a Kayman client and issues the API's own JWTs."""

    def __init__(self, base_url: str) -> None:
        super().__init__(
            base_url=base_url,
            client_registration_options=ClientRegistrationOptions(enabled=True),
        )
        self.pending: dict[str, PendingAuthorization] = {}
        self._verifier = JWTVerifier(
            public_key=settings.SECRET_KEY, algorithm=ALGORITHM
        )

    async def authorize(
        self, client: OAuthClientInformationFull, params: AuthorizationParams
    ) -> str:
        request_id = secrets.token_urlsafe(32)
        expires_at = time.time() + AUTHORIZATION_EXPIRY_SECONDS
        self.pending[request_id] = PendingAuthorization(client, params, expires_at)
        return f"{str(self.base_url).rstrip('/')}{LOGIN_PATH}?request={request_id}"

    def complete_authorization(self, request_id: str, subject: str) -> str | None:
        """Issue the code for a logged-in client and return the browser redirect."""
        pending = self.pending.pop(request_id, None)
        if pending is None or pending.expires_at < time.time():
            return None
        params = pending.params
        code = secrets.token_urlsafe(32)
        self.auth_codes[code] = AuthorizationCode(
            code=code,
            client_id=pending.client.client_id or "",
            redirect_uri=params.redirect_uri,
            redirect_uri_provided_explicitly=params.redirect_uri_provided_explicitly,
            scopes=params.scopes or [],
            expires_at=time.time() + AUTHORIZATION_EXPIRY_SECONDS,
            code_challenge=params.code_challenge,
            resource=params.resource,
            subject=subject,
        )
        return construct_redirect_uri(
            str(params.redirect_uri), code=code, state=params.state
        )

    async def exchange_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: AuthorizationCode
    ) -> OAuthToken:
        if self.auth_codes.pop(authorization_code.code, None) is None:
            raise TokenError(
                "invalid_grant", "Authorization code not found or already used."
            )
        return self._issue_tokens(
            client, authorization_code.scopes, authorization_code.subject
        )

    async def exchange_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: RefreshToken,
        scopes: list[str],
    ) -> OAuthToken:
        self.refresh_tokens.pop(refresh_token.token, None)
        return self._issue_tokens(client, scopes, refresh_token.subject)

    def _issue_tokens(
        self, client: OAuthClientInformationFull, scopes: list[str], subject: str | None
    ) -> OAuthToken:
        if subject is None:
            raise TokenError("invalid_grant", "Authorization has no subject.")
        refresh = secrets.token_urlsafe(32)
        self.refresh_tokens[refresh] = RefreshToken(
            token=refresh,
            client_id=client.client_id or "",
            scopes=scopes,
            expires_at=None,
            subject=subject,
        )
        return OAuthToken(
            access_token=create_access_token({"sub": subject}, ACCESS_TOKEN_EXPIRY),
            token_type="Bearer",
            expires_in=int(ACCESS_TOKEN_EXPIRY.total_seconds()),
            refresh_token=refresh,
            scope=" ".join(scopes),
        )

    async def load_access_token(self, token: str) -> AccessToken | None:  # type: ignore[override]
        return await self._verifier.load_access_token(token)

    async def verify_token(self, token: str) -> AccessToken | None:  # type: ignore[override]
        return await self.load_access_token(token)

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:
        if isinstance(token, RefreshToken):
            self.refresh_tokens.pop(token.token, None)
