import uuid

from app.schemas.common import Schema


class UserOut(Schema):
    id: uuid.UUID
    email: str
    display_name: str
