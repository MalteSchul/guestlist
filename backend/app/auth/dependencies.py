from typing import Annotated

from fastapi import Depends, HTTPException, Response, status
from fastapi.security import APIKeyCookie

from app.config import get_settings
from app.db import SessionDep
from app.models import User
from app.services import login_sessions
from app.services.users import get_or_create_user_for_login

DEV_ISSUER = "dev-bypass"
DEV_SUBJECT = "dev-user"
DEV_EMAIL = "dev@localhost"

SESSION_COOKIE = "session"

session_cookie = APIKeyCookie(name=SESSION_COOKIE, auto_error=False)


def secure_cookies() -> bool:
    # Locally the app runs on plain http, where a Secure cookie isn't stored by every browser.
    return get_settings().environment == "production"


def set_session_cookie(response: Response, token: str) -> None:
    # HttpOnly: page scripts never see it. SameSite=Lax: other sites can't send requests with it,
    # but a link to the app from a mail still arrives logged in.
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(login_sessions.LIFETIME.total_seconds()),
        httponly=True,
        secure=secure_cookies(),
        samesite="lax",
    )


def current_user(
    session: SessionDep,
    response: Response,
    token: Annotated[str | None, Depends(session_cookie)],
) -> User:
    if get_settings().auth_dev_bypass:
        return get_or_create_user_for_login(
            session,
            issuer=DEV_ISSUER,
            subject=DEV_SUBJECT,
            email=DEV_EMAIL,
            display_name="Dev User",
        )

    found = login_sessions.user_for(session, token) if token else None
    if found is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not logged in")
    user, renewed = found
    if renewed:
        set_session_cookie(response, token)
    return user


CurrentUser = Annotated[User, Depends(current_user)]
