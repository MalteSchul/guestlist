"""Login with Google: the authorization code flow with PKCE, run by the backend (A28). Google's
page is the only thing the browser sees of it; the code is swapped for the ID token here, with
the client secret."""

import base64
import hashlib
import json
import secrets
from functools import lru_cache
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import jwt

from app.config import get_settings

ISSUER = "https://accounts.google.com"
AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"


class LoginFailed(Exception):
    pass


def new_verifier() -> str:
    return secrets.token_urlsafe(48)


def authorize_url(redirect_uri: str, state: str, verifier: str) -> str:
    """Google's login page, which sends the person back to `redirect_uri` with a code."""
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    params = {
        "client_id": get_settings().google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        # Lets someone pick another account after signing out, instead of the last one again.
        "prompt": "select_account",
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def exchange_code(code: str, verifier: str, redirect_uri: str) -> dict[str, Any]:
    """The checked ID token claims of whoever just logged in at Google."""
    settings = get_settings()
    body = urlencode(
        {
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": verifier,
            "redirect_uri": redirect_uri,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
        }
    ).encode()
    try:
        with urlopen(Request(TOKEN_URL, data=body), timeout=10) as response:
            id_token = json.load(response)["id_token"]
    except (OSError, KeyError, ValueError) as e:
        raise LoginFailed(f"token exchange: {e}") from e
    return validate_id_token(id_token)


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    # Caches Google's signing keys and refetches when a token names an unknown one.
    return jwt.PyJWKClient(JWKS_URL)


def validate_id_token(token: str) -> dict[str, Any]:
    try:
        key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            audience=get_settings().google_client_id,
            issuer=[ISSUER, "accounts.google.com"],
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as e:
        raise LoginFailed(str(e)) from e
    # Logins join users by email (A14), so the address has to be the person's own.
    if not claims.get("email") or claims.get("email_verified") is not True:
        raise LoginFailed("email not verified")
    return claims
