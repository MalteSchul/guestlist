from fastapi import APIRouter

router = APIRouter(tags=["health"])


# Doesn't touch the database, so probes never keep Neon awake.
@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
