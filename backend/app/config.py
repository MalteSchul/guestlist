from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # No defaults: a missing variable fails at startup instead of silently running as "local".
    environment: Literal["local", "production"]
    database_url: str

    # The React build to serve (set in the image). Unset in development, where Vite serves it.
    frontend_dir: Path | None = None

    # Local only: every admin request is the fixed dev user, no login needed.
    auth_dev_bypass: bool = False

    # Google login (A28). Required unless the dev bypass is on. Only the backend talks to Google
    # with these, so the secret never reaches the browser.
    google_client_id: str | None = None
    google_client_secret: str | None = None

    @model_validator(mode="after")
    def check_auth(self) -> "Settings":
        if self.auth_dev_bypass:
            if self.environment != "local":
                raise ValueError("AUTH_DEV_BYPASS is only allowed with ENVIRONMENT=local")
        elif not (self.google_client_id and self.google_client_secret):
            raise ValueError(
                "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required "
                "unless AUTH_DEV_BYPASS is on"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
