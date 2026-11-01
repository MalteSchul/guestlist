"""Serves the React build next to the API: one image, one domain, no CORS (A26)."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

# Vite puts a content hash into every file name under assets/.
IMMUTABLE = "public, max-age=31536000, immutable"


def serve_frontend(app: FastAPI, build: Path) -> None:
    """Register last: the catch-all must not shadow the API routes."""
    build = build.resolve()
    index = build / "index.html"

    # HEAD too: link previews and some clients check a URL with it.
    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def frontend(path: str) -> FileResponse:
        file = (build / path).resolve()
        if path and file.is_file() and file.is_relative_to(build):
            cache = IMMUTABLE if path.startswith("assets/") else "no-cache"
            return FileResponse(file, headers={"Cache-Control": cache})
        # Unknown API routes stay 404s. A missing asset is an old chunk after a deploy: it must
        # not get the app back as JavaScript.
        if path == "api" or path.startswith(("api/", "assets/")):
            raise HTTPException(404)
        # Client-side routes (/i/<token>, /r/<token> and the host pages) all get the app.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
