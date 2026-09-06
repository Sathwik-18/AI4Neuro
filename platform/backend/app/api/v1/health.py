"""Health endpoints (doc 5.1)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import Principal
from app.services.supabase_client import get_service_client

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: str
    timestamp: str


class DatabaseHealthResponse(BaseModel):
    status: str
    configured: bool


class StorageBuckets(BaseModel):
    raw_files: str
    report_assets: str
    reports: str
    viewer_slices: str


class StorageHealthResponse(BaseModel):
    status: str
    configured: bool
    buckets: StorageBuckets


@router.get("", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", timestamp=datetime.now(timezone.utc).isoformat())


@router.get("/database", response_model=DatabaseHealthResponse)
def health_database(principal: Principal = Depends(get_current_user)) -> DatabaseHealthResponse:
    """Report whether Supabase is configured (does not run a query in MVP)."""
    settings = get_settings()
    configured = bool(settings.supabase_url and settings.supabase_service_role_key)
    return DatabaseHealthResponse(status="ok" if configured else "not_configured", configured=configured)


@router.get("/storage", response_model=StorageHealthResponse)
def health_storage(principal: Principal = Depends(get_current_user)) -> StorageHealthResponse:
    settings = get_settings()
    configured = get_service_client() is not None
    return StorageHealthResponse(
        status="ok" if configured else "not_configured",
        configured=configured,
        buckets=StorageBuckets(
            raw_files=settings.raw_files_bucket,
            report_assets=settings.report_assets_bucket,
            reports=settings.reports_bucket,
            viewer_slices=settings.viewer_slices_bucket,
        ),
    )
