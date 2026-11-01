import logging

from app.access_log import MaskSecretLinks


def log_line(path: str) -> str:
    # The way uvicorn logs a request.
    record = logging.LogRecord(
        "uvicorn.access",
        logging.INFO,
        "",
        0,
        '%s - "%s %s HTTP/%s" %d',
        ("10.0.0.1:5000", "GET", path, "1.1", 200),
        None,
    )
    MaskSecretLinks().filter(record)
    return record.getMessage()


def test_invite_token_is_masked():
    assert log_line("/i/SECRET") == '10.0.0.1:5000 - "GET /i/<token> HTTP/1.1" 200'
    assert log_line("/i/SECRET?lang=de") == '10.0.0.1:5000 - "GET /i/<token>?lang=de HTTP/1.1" 200'


def test_signup_token_is_masked():
    assert log_line("/r/SECRET") == '10.0.0.1:5000 - "GET /r/<token> HTTP/1.1" 200'


def test_other_paths_stay():
    assert log_line("/api/guest/invite") == '10.0.0.1:5000 - "GET /api/guest/invite HTTP/1.1" 200'
