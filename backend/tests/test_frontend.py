from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.frontend import IMMUTABLE, serve_frontend
from app.routers import health


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    build = tmp_path / "build"
    (build / "assets").mkdir(parents=True)
    (build / "index.html").write_text("<app>")
    (build / "assets" / "index-abc123.js").write_text("js")
    (build / "favicon.svg").write_text("<svg/>")
    (tmp_path / "secret.txt").write_text("secret")

    app = FastAPI()
    app.include_router(health.router, prefix="/api")
    serve_frontend(app, build)
    return TestClient(app)


def test_client_routes_get_the_app(client):
    for path in ("/", "/i/abc", "/events/123/settings"):
        response = client.get(path)
        assert response.text == "<app>"
        assert response.headers["cache-control"] == "no-cache"


def test_head_works_like_get(client):
    response = client.head("/i/abc")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"


def test_assets_are_cached_for_good(client):
    response = client.get("/assets/index-abc123.js")
    assert response.text == "js"
    assert response.headers["cache-control"] == IMMUTABLE


def test_other_files_are_revalidated(client):
    response = client.get("/favicon.svg")
    assert response.text == "<svg/>"
    assert response.headers["cache-control"] == "no-cache"


def test_api_routes_come_first(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_unknown_api_routes_and_missing_assets_are_404(client):
    for path in ("/api", "/api/nope", "/assets/index-old.js"):
        assert client.get(path).status_code == 404


def test_nothing_outside_the_build(client):
    assert client.get("/..%2Fsecret.txt").text == "<app>"
