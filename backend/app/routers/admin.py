from fastapi import APIRouter

from app.auth.dependencies import CurrentUser
from app.schemas.users import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
