from fastapi.testclient import TestClient

from app.main import create_app


def test_health_ok():
    with TestClient(create_app()) as client:
        res = client.get("/api/v1/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


def test_health_database_not_configured(monkeypatch):
    from app.core.config import get_settings

    # A developer's local .env may hold real Supabase keys; blank them here.
    settings = get_settings()
    monkeypatch.setattr(settings, "supabase_url", None)
    monkeypatch.setattr(settings, "supabase_service_role_key", None)
    with TestClient(create_app()) as client:
        res = client.get("/api/v1/health/database")
        assert res.status_code == 200
        assert res.json()["configured"] is False


def test_root_banner():
    with TestClient(create_app()) as client:
        res = client.get("/")
        assert res.status_code == 200
        assert res.json()["api"] == "/api/v1"
