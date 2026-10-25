from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.tokens import InvalidToken, validate_access_token
from app.config import get_settings
from app.db import get_session
from app.models import User
from app.services.users import get_or_create_user_for_login

DEV_ISSUER = "dev-bypass"
DEV_SUBJECT = "dev-user"
DEV_EMAIL = "dev@localhost"

_bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"}
    )


def current_user(
    session: Annotated[Session, Depends(get_session)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if get_settings().auth_dev_bypass:
        return get_or_create_user_for_login(
            session,
            issuer=DEV_ISSUER,
            subject=DEV_SUBJECT,
            email=DEV_EMAIL,
            display_name="Dev User",
        )

    if credentials is None:
        raise _unauthorized("not logged in")
    try:
        claims = validate_access_token(credentials.credentials)
    except InvalidToken as e:
        raise _unauthorized("invalid token") from e

    email = claims.get("email")
    if not email:
        raise _unauthorized("token has no email claim")
    return get_or_create_user_for_login(
        session,
        issuer=claims["iss"],
        subject=claims["sub"],
        email=email,
        display_name=claims.get("name") or email,
    )


CurrentUser = Annotated[User, Depends(current_user)]
