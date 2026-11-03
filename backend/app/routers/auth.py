"""How the frontend logs hosts in. Public: the page needs it before anyone is logged in."""

from typing import Literal

from fastapi import APIRouter

from app.config import get_settings
from app.schemas.common import Schema

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthConfig(Schema):
    mode: Literal["dev", "oidc"]
    """"dev": no login, every request is the dev user (local only, A13). "oidc": log in first."""
    authority: str | None = None
    client_id: str | None = None
    scope: str | None = None
    """The API scope to ask for, next to the standard OIDC scopes."""


@router.get("/config")
def auth_config() -> AuthConfig:
    settings = get_settings()
    if settings.auth_dev_bypass:
        return AuthConfig(mode="dev")
    return AuthConfig(
        mode="oidc",
        authority=settings.oidc_authority,
        client_id=settings.oidc_client_id,
        scope=settings.oidc_client_scope,
    )
