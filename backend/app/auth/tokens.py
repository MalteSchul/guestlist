"""Access token validation. Standard OIDC/JWT only, nothing provider-specific (A7)."""

from functools import lru_cache
from typing import Any

import jwt

from app.config import get_settings


class InvalidToken(Exception):
    pass


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    # Caches the signing keys and refetches when a token names an unknown key.
    return jwt.PyJWKClient(get_settings().oidc_jwks_url)


def validate_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            audience=settings.oidc_audience,
            issuer=settings.oidc_issuer,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as e:
        raise InvalidToken(str(e)) from e

    required_scope = settings.oidc_required_scope
    if required_scope and required_scope not in claims.get("scp", "").split():
        raise InvalidToken(f"missing scope {required_scope}")
    return claims
