from fastapi import APIRouter

router = APIRouter(tags=["health"])


# Doesn't touch the database, so probes never keep Neon awake. HEAD for uptime monitors.
@router.get("/health")
@router.head("/health", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok"}
