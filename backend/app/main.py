from fastapi import FastAPI

from app.routers import admin, health

app = FastAPI(title="Guestlist", version="0.1.0")

# nginx forwards /api/* unchanged, so the prefix lives here.
for router in (health.router, admin.router):
    app.include_router(router, prefix="/api")
