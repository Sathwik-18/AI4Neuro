"""Database errors must come back as structured JSON, not crash the handler."""

from __future__ import annotations

from fastapi.testclient import TestClient
from google.api_core import exceptions as gexc

from app.main import create_app


def _get(exc: Exception):
    app = create_app()

    @app.get("/boom")
    def boom():
        raise exc

    with TestClient(app, raise_server_exceptions=False) as client:
        return client.get("/boom")


def test_database_error_returns_structured_json():
    res = _get(gexc.InternalServerError("backend exploded"))
    assert res.status_code == 500
    assert res.json()["error"]["code"] == "database_error"


def test_database_unavailable_maps_to_503():
    res = _get(gexc.ServiceUnavailable("try later"))
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "upstream_unavailable"
