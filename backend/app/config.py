from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # No defaults: a missing variable fails at startup instead of silently running as "local".
    environment: Literal["local", "production"]
    database_url: str

    # Local only: every admin request is the fixed dev user, no token needed.
    auth_dev_bypass: bool = False

    # OIDC (Entra External ID). Required unless the dev bypass is on.
    oidc_issuer: str | None = None
    oidc_audience: str | None = None
    oidc_jwks_url: str | None = None
    oidc_required_scope: str | None = None

    @model_validator(mode="after")
    def check_auth(self) -> "Settings":
        if self.auth_dev_bypass:
            if self.environment != "local":
                raise ValueError("AUTH_DEV_BYPASS is only allowed with ENVIRONMENT=local")
        elif not (self.oidc_issuer and self.oidc_audience and self.oidc_jwks_url):
            raise ValueError(
                "OIDC_ISSUER, OIDC_AUDIENCE and OIDC_JWKS_URL are required "
                "unless AUTH_DEV_BYPASS is on"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
