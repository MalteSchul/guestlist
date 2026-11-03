from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.access_log import mask_secret_links
from app.config import get_settings
from app.frontend import serve_frontend
from app.routers import address_book, admin, auth, guest, health
from app.services.errors import ServiceError

settings = get_settings()

# API docs only locally: production has never exposed them.
app = FastAPI(
    title="Guestlist",
    version="0.1.0",
    openapi_url="/openapi.json" if settings.environment == "local" else None,
)
mask_secret_links()

SECURITY_HEADERS = {
    # Guest links carry a secret token: never pass it on to another site (A12).
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


@app.middleware("http")
async def security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    return response


# The app and the API share one domain (A26), so the API lives under /api.
for router in (health.router, auth.router, admin.router, address_book.router, guest.router):
    app.include_router(router, prefix="/api")

if settings.frontend_dir:
    serve_frontend(app, settings.frontend_dir)


@app.exception_handler(ServiceError)
def service_error(request: Request, exc: ServiceError) -> JSONResponse:
    return JSONResponse({"detail": str(exc)}, status_code=exc.status_code)
