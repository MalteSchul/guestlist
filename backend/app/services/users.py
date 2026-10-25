from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Identity, User


def get_or_create_user_for_login(
    session: Session, *, issuer: str, subject: str, email: str, display_name: str
) -> User:
    """Map a login identity to our own user, creating the user on first login.

    A new identity with a known email is attached to that existing user. This assumes every
    login provider we accept verifies email addresses; revisit before adding one that doesn't.
    """
    user = session.scalar(
        select(User).join(Identity).where(Identity.issuer == issuer, Identity.subject == subject)
    )
    if user is not None:
        return user

    user = session.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if user is None:
        user = User(email=email, display_name=display_name)
        session.add(user)
        session.flush()
    session.add(Identity(user_id=user.id, issuer=issuer, subject=subject))
    session.commit()
    return user
