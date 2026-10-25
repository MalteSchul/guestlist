"""Errors a use case reports to its caller. One handler in main.py turns them into HTTP responses,
so services never import FastAPI."""


class ServiceError(Exception):
    status_code = 400


class NotFound(ServiceError):
    status_code = 404


class Forbidden(ServiceError):
    status_code = 403


class Conflict(ServiceError):
    """The request is fine, but the current state doesn't allow it."""

    status_code = 409


class Invalid(ServiceError):
    """The request breaks a business rule that needs existing data to check."""

    status_code = 422
