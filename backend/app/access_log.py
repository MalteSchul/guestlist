"""Guest links carry a secret token: keep it out of the access log (A12)."""

import logging
import re

_INVITE = re.compile(r"^/i/[^/?]+")


def mask(path: str) -> str:
    return _INVITE.sub("/i/<token>", path)


class MaskInviteTokens(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # uvicorn logs (client, method, path, HTTP version, status).
        if isinstance(record.args, tuple) and len(record.args) == 5:
            client, method, path, version, status = record.args
            record.args = (client, method, mask(str(path)), version, status)
        return True


def mask_invite_tokens() -> None:
    logging.getLogger("uvicorn.access").addFilter(MaskInviteTokens())
