from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class Schema(BaseModel):
    # from_attributes: responses are read straight from ORM objects.
    # extra="forbid": a misspelled field is an error, not silently ignored.
    model_config = ConfigDict(from_attributes=True, extra="forbid")
