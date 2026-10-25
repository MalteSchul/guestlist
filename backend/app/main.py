from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.routers import admin, guest, health
from app.services.errors import ServiceError

app = FastAPI(title="Guestlist", version="0.1.0")

# nginx forwards /api/* unchanged, so the prefix lives here.
for router in (health.router, admin.router, guest.router):
    app.include_router(router, prefix="/api")


@app.exception_handler(ServiceError)
def service_error(request: Request, exc: ServiceError) -> JSONResponse:
    return JSONResponse({"detail": str(exc)}, status_code=exc.status_code)
