"""Write the OpenAPI contract to contract/openapi.json. CI runs this and fails on any diff (A5).

Run from backend/: uv run python -m scripts.export_openapi
"""

import json
import os
from pathlib import Path

# The contract doesn't depend on configuration, but importing the app needs settings.
os.environ.setdefault("ENVIRONMENT", "local")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://unused@localhost/unused")
os.environ.setdefault("AUTH_DEV_BYPASS", "true")

from app.main import app  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "contract" / "openapi.json"


def main() -> None:
    OUT.parent.mkdir(exist_ok=True)
    contract = json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"
    # Always LF, so a run on Windows and on CI produce the same bytes.
    OUT.write_text(contract, encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
