"""Host login (A28): Google's page, then a session cookie of our own. Public: whoever isn't
logged in yet needs it."""

import logging
import secrets
from typing import Annotated, Literal
from urllib.parse import quote, unquote, urlencode

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.responses import RedirectResponse

from app.auth import google
from app.auth.dependencies import SESSION_COOKIE, secure_cookies, session_cookie, set_session_cookie
from app.config import get_settings
from app.db import SessionDep
from app.schemas.common import Schema
from app.services import login_sessions
from app.services.users import get_or_create_user_for_login

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# What the login started with, kept in the browser until Google sends the person back.
LOGIN_COOKIE = "google_login"
LOGIN_COOKIE_PATH = "/api/auth/google"


class AuthConfig(Schema):
    mode: Literal["dev", "google"]
    """"dev": no login, every request is the dev user (local only, A13). "google": log in first."""


@router.get("/config")
def auth_config() -> AuthConfig:
    return AuthConfig(mode="dev" if get_settings().auth_dev_bypass else "google")


def _local_path(to: str) -> str:
    """Only pages of this app, so the login can't be used to send someone elsewhere."""
    return to if to.startswith("/") and not to.startswith("//") and "\\" not in to else "/"


def _callback_url(request: Request) -> str:
    return str(request.url_for("google_callback"))


@router.get("/google", include_in_schema=False)
def google_login(request: Request, to: str = "/") -> RedirectResponse:
    """Off to Google's login page; afterwards back to the page `to`."""
    state = secrets.token_urlsafe(32)
    verifier = google.new_verifier()
    response = RedirectResponse(google.authorize_url(_callback_url(request), state, verifier))
    response.set_cookie(
        LOGIN_COOKIE,
        "|".join((state, verifier, quote(_local_path(to), safe=""))),
        max_age=600,
        path=LOGIN_COOKIE_PATH,
        httponly=True,
        secure=secure_cookies(),
        samesite="lax",
    )
    return response


@router.get("/google/callback", name="google_callback", include_in_schema=False)
def google_callback(
    request: Request,
    session: SessionDep,
    code: str | None = None,
    state: str | None = None,
    login: Annotated[str | None, Cookie(alias=LOGIN_COOKIE)] = None,
) -> RedirectResponse:
    """Back from Google: log the person in and go to the page they wanted. If that didn't work
    (cancelled, or a link that isn't from this browser's login), that page says so."""
    parts = (login or "").split("|")
    expected_state, verifier, to = parts if len(parts) == 3 else ("", "", "/")
    to = _local_path(unquote(to))
    try:
        ours = bool(code and state and expected_state) and secrets.compare_digest(
            state or "", expected_state
        )
        if not ours:
            raise google.LoginFailed("no code, or the state doesn't match")
        claims = google.exchange_code(code, verifier, _callback_url(request))
    except google.LoginFailed as e:
        logger.warning("Google login failed: %s", e)
        separator = "&" if "?" in to else "?"
        response = RedirectResponse(f"{to}{separator}{urlencode({'login': 'failed'})}", 303)
    else:
        user = get_or_create_user_for_login(
            session,
            issuer=google.ISSUER,
            subject=claims["sub"],
            email=claims["email"],
            display_name=claims.get("name") or claims["email"],
        )
        response = RedirectResponse(to, 303)
        set_session_cookie(response, login_sessions.start(session, user.id))
    response.delete_cookie(LOGIN_COOKIE, path=LOGIN_COOKIE_PATH)
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(session: SessionDep, token: Annotated[str | None, Depends(session_cookie)]) -> Response:
    if token:
        login_sessions.end(session, token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(SESSION_COOKIE)
    return response
