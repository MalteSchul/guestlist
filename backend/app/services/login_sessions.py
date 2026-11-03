"""Logged-in browsers (A28). The cookie holds a random token; only its hash is stored, so the
table can't be used to log in."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import LoginSession, User

LIFETIME = timedelta(days=90)
# A session in use is extended to the full lifetime, at most once a day.
RENEW_AFTER = timedelta(days=1)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start(session: Session, user_id: uuid.UUID) -> str:
    """A new session for the user; returns the token for the cookie."""
    now = datetime.now(UTC)
    session.execute(delete(LoginSession).where(LoginSession.expires_at <= now))
    token = secrets.token_urlsafe(32)
    session.add(LoginSession(token_hash=_hash(token), user_id=user_id, expires_at=now + LIFETIME))
    session.commit()
    return token


def user_for(session: Session, token: str) -> tuple[User, bool] | None:
    """The session's user, and whether the session was just extended (then the cookie has to be
    sent again with the new lifetime). None if the token is unknown or ran out."""
    now = datetime.now(UTC)
    login = session.scalar(
        select(LoginSession).where(
            LoginSession.token_hash == _hash(token), LoginSession.expires_at > now
        )
    )
    if login is None:
        return None
    renewed = login.expires_at - now < LIFETIME - RENEW_AFTER
    if renewed:
        login.expires_at = now + LIFETIME
        session.commit()
    user = session.get(User, login.user_id)
    assert user is not None  # the session is deleted with its user
    return user, renewed


def end(session: Session, token: str) -> None:
    session.execute(delete(LoginSession).where(LoginSession.token_hash == _hash(token)))
    session.commit()
