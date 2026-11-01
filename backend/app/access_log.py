"""Guest links and the open sign-up link carry a secret token: keep it out of the access log
(A12, D36)."""

import logging
import re

_SECRET_LINK = re.compile(r"^/([ir])/[^/?]+")


def mask(path: str) -> str:
    return _SECRET_LINK.sub(r"/\1/<token>", path)


class MaskSecretLinks(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # uvicorn logs (client, method, path, HTTP version, status).
        if isinstance(record.args, tuple) and len(record.args) == 5:
            client, method, path, version, status = record.args
            record.args = (client, method, mask(str(path)), version, status)
        return True


def mask_secret_links() -> None:
    logging.getLogger("uvicorn.access").addFilter(MaskSecretLinks())
