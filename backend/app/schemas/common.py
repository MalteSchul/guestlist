from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class Schema(BaseModel):
    # from_attributes: responses are read straight from ORM objects.
    # extra="forbid": a misspelled field is an error, not silently ignored.
    model_config = ConfigDict(from_attributes=True, extra="forbid")


def _is_none(value: object) -> bool:
    return value is None


class Translated(Schema):
    """Host-written text guests see, in German and/or English (D16). Missing languages are left
    out of the stored JSON instead of being stored as null."""

    de: LongText | None = Field(default=None, exclude_if=_is_none)
    en: LongText | None = Field(default=None, exclude_if=_is_none)

    @model_validator(mode="after")
    def not_empty(self) -> "Translated":
        if self.de is None and self.en is None:
            raise ValueError("needs text in de or en")
        return self
