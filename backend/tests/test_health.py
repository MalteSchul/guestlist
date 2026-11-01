from fastapi.testclient import TestClient

from app.main import app


def test_health():
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_answers_head():
    assert TestClient(app).head("/api/health").status_code == 200


def test_security_headers():
    headers = TestClient(app).get("/api/health").headers
    assert headers["referrer-policy"] == "no-referrer"
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
