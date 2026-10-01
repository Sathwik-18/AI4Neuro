"""Unified analysis API (doc 5).

One endpoint pair for both modalities. The frontend only chooses ``modality``;
the backend routes to the right pipeline internally. Result shapes are identical
across modalities.
"""

# No `from __future__ import annotations`: slowapi's @limiter.limit wrapper
# hides this module's globals, so FastAPI can't resolve string annotations.
import json

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import get_current_user, get_database, get_storage
from app.core.cache import cached
from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.core.security import Principal
from app.services import permissions

limiter = Limiter(key_func=get_remote_address)
from app.schemas.analysis import (
    ALLOWED_EXTENSIONS,
    AnalysisResultResponse,
    AnalysisStatsResponse,
    CancelResponse,
    CreateAnalysisResponse,
    Modality,
    ReportsResponse,
    ReportUrls,
    RetryResponse,
    SessionListItem,
    SessionStatus,
    SessionStatusResponse,
    TrendBucket,
)
from app.schemas.common import PaginatedResponse
from app.services.database import DatabaseService
from app.services.jobs import get_job_service
from app.services.storage import StorageService

logger = get_logger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _validate_upload(modality: str, filename: str) -> None:
    if modality not in {m.value for m in Modality}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_modality", "message": f"Unknown modality {modality!r}."},
        )
    allowed = ALLOWED_EXTENSIONS[modality]
    lower = (filename or "").lower()
    if not any(lower.endswith(ext) for ext in allowed):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_file_type",
                "message": f"{modality} accepts {', '.join(allowed)}; got {filename!r}.",
            },
        )


def _normalize_analysis_type(modality: str, analysis_type: str) -> str:
    value = (analysis_type or "").strip().lower()
    if modality == Modality.mri.value and value == "ad-only":
        value = "binary"  # legacy frontend alias
    if modality == Modality.eeg.value:
        # EEG is ADFD-only: the ADSZ (binary) checkpoint is retired server-side.
        # Force multiclass regardless of client input so pre-update frontend
        # clients that still send "binary" keep working, mirroring the MRI
        # override above.
        return "multiclass"
    allowed = {"binary", "multiclass"}
    if value not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_analysis_type",
                "message": "Analysis type must be Binary or Multiclass.",
            },
        )
    return value


def _safe_exception_details(exc: Exception) -> dict:
    """Return a safe error summary without leaking schema internals."""
    from app.core.config import get_settings
    if get_settings().is_production:
        return {"type": exc.__class__.__name__}
    return {
        "type": exc.__class__.__name__,
        "message": str(exc)[:500],
    }


@router.post("", response_model=CreateAnalysisResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
async def create_analysis(
    request: Request,
    file: UploadFile = File(...),
    modality: str = Form(...),
    analysis_type: str = Form(...),
    patient_id: str | None = Form(default=None),
    doctor_id: str | None = Form(default=None),
    hospital_id: str | None = Form(default=None),
    radiologist_id: str | None = Form(default=None),
    uploaded_by_role: str | None = Form(default=None),
    channel_index: int | None = Form(default=None),        # EEG: similarity-plot channel
    scan_metadata_json: str | None = Form(default=None),   # MRI: scanner/sequence metadata
    eeg_metadata_json: str | None = Form(default=None),    # EEG: channel names + sampling rate
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
    storage: StorageService = Depends(get_storage),
    settings: Settings = Depends(get_settings),
) -> CreateAnalysisResponse:
    modality = modality.lower().strip()
    _validate_upload(modality, file.filename or "")
    analysis_type = _normalize_analysis_type(modality, analysis_type)

    if not permissions.can_create_analysis(principal.role, modality):
        raise _forbid(f"Your role may not create {modality} analyses.")

    # Anonymous ("outsider") scans: only a super_admin may run an analysis with
    # no patient record. Everyone else must name a real patient. An anonymous
    # sentinel or empty value collapses to a NULL patient_id (and, for
    # super_admin, an implicitly hospital-less session — see below).
    _ANON = {"", "anonymous", "__anonymous__", "none"}
    is_anonymous_patient = not patient_id or patient_id.strip().lower() in _ANON
    if is_anonymous_patient:
        if principal.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "patient_required", "message": "A patient is required for this analysis."},
            )
        patient_id = None
    if doctor_id and doctor_id.strip().lower() in _ANON:
        doctor_id = None

    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "file_too_large",
                "message": f"File exceeds {settings.max_upload_mb} MB limit.",
            },
        )

    pipeline_options = _build_pipeline_options(
        modality, channel_index, scan_metadata_json, eeg_metadata_json
    )
    uploaded_by_role = uploaded_by_role or principal.role

    # Authorization gap fix: reads are strictly hospital-scoped
    # (permissions.can_read_session), but this write previously accepted a
    # client-supplied hospital_id with no verification it matched the
    # caller's own hospital. Only super_admin may create analyses for a
    # hospital other than their own.
    if principal.role != "super_admin":
        if hospital_id and str(hospital_id) != str(principal.hospital_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "hospital_mismatch",
                    "message": "hospital_id must match your own hospital.",
                },
            )
        hospital_id = principal.hospital_id
    else:
        hospital_id = hospital_id or principal.hospital_id

    if principal.role == "radiologist" and not radiologist_id:
        radiologist_id = principal.user_id
    if principal.role == "doctor" and not doctor_id:
        doctor_id = principal.user_id

    if doctor_id and principal.role != "super_admin":
        doc_profile = db.get_user_profile(doctor_id)
        if not doc_profile or doc_profile.get("role") != "doctor" or str(doc_profile.get("hospital_id")) != str(hospital_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "invalid_doctor", "message": "Named doctor does not exist or does not belong to this hospital."},
            )
    if radiologist_id and radiologist_id != principal.user_id and principal.role != "super_admin":
        rad_profile = db.get_user_profile(radiologist_id)
        if not rad_profile or rad_profile.get("role") != "radiologist" or str(rad_profile.get("hospital_id")) != str(hospital_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "invalid_radiologist", "message": "Named radiologist does not exist or does not belong to this hospital."},
            )

    # 1) Create the session row (queued).
    try:
        session = db.create_session(
            modality=modality,
            analysis_type=analysis_type,
            original_filename=file.filename or "upload",
            patient_id=patient_id,
            doctor_id=doctor_id,
            radiologist_id=radiologist_id,
            hospital_id=hospital_id,
            uploaded_by=None if principal.is_dev else principal.user_id,
            uploaded_by_role=uploaded_by_role,
            pipeline_options=pipeline_options,
        )
    except Exception as exc:
        logger.exception("Failed to create analysis session.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "analysis_session_create_failed",
                "message": (
                    "Could not create the analysis session. Verify the selected patient, "
                    "doctor, hospital, and unified Supabase schema."
                ),
                "details": _safe_exception_details(exc),
            },
        ) from exc
    session_id = str(session["id"])

    # 2) Upload the raw file and record its location.
    try:
        bucket, path = storage.upload_raw_file(
            modality=modality,
            session_id=session_id,
            filename=file.filename or "upload",
            data=data,
        )
        db.set_raw_file(session_id, path=path, bucket=bucket)
        db.insert_job_event(session_id, message="Upload stored", stage="saved_upload")
    except Exception as exc:
        logger.exception("Failed to store raw upload for session %s.", session_id)
        db.mark_failed(session_id, f"Upload storage failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "raw_upload_failed",
                "message": "Could not store the uploaded file. Verify Supabase storage buckets.",
                "details": _safe_exception_details(exc),
            },
        ) from exc

    # 3) Enqueue background processing (behind the JobService boundary).
    try:
        get_job_service().enqueue_analysis(session_id)
    except Exception as exc:
        logger.exception("Failed to enqueue analysis job for session %s.", session_id)
        db.mark_failed(session_id, f"Job enqueue failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "job_enqueue_failed",
                "message": "Analysis session was created, but processing could not be started.",
                "details": _safe_exception_details(exc),
            },
        ) from exc

    return CreateAnalysisResponse(
        session_id=session_id,
        status=SessionStatus.queued.value,
        modality=modality,
        analysis_type=analysis_type,
    )


_SORTS = {"newest", "oldest", "patient_asc", "patient_desc", "confidence_desc"}
_STATS_RANGES = {"today": 0, "week": 6, "month": 29, "quarter": 89, "all": None}
_TREND_SPANS = {"8w": ("week", 8), "12w": ("week", 12), "6m": ("month", 6), "12m": ("month", 12)}


def _display_names(db: DatabaseService, hospital: str | None) -> dict[str, str]:
    return cached(
        f"hospital:users:names:{hospital or 'ALL'}",
        lambda: {str(u["id"]): u.get("full_name") or "" for u in db.list_user_profiles(hospital_id=hospital)},
    )


def _enriched_sessions(
    principal: Principal,
    db: DatabaseService,
    *,
    modality: str | None = None,
    status_filter: str | None = None,
    patient_id: str | None = None,
    doctor_id: str | None = None,
    radiologist_id: str | None = None,
    hospital_id: str | None = None,
    mine: bool = False,
    analysis_type: str | None = None,
    prediction: str | None = None,
    priority: str | None = None,
    q: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[list[dict], dict[str, str]]:
    """Sessions the caller may read, joined with outcome + review priority and
    filtered. super_admin may narrow by hospital; every other role is pinned to
    their own hospital, and each row passes the same per-session read check."""
    from app.services.triage import canonical_analysis_type, canonical_prediction, review_priority

    hospital = hospital_id if principal.role == "super_admin" else principal.hospital_id
    rows = db.list_sessions(
        modality=modality,
        status=status_filter,
        patient_id=patient_id,
        doctor_id=doctor_id,
        radiologist_id=radiologist_id,
        hospital_id=hospital,
    )
    rows = [
        r for r in rows
        if permissions.can_read_session(principal.user_id, principal.role, principal.hospital_id, r)
    ]
    if mine:
        rows = [r for r in rows if str(r.get("uploaded_by")) == str(principal.user_id)]
    if analysis_type:
        rows = [r for r in rows if canonical_analysis_type(r.get("analysis_type")) == analysis_type]
    if date_from:
        rows = [r for r in rows if str(r.get("created_at") or "")[:10] >= date_from]
    if date_to:
        rows = [r for r in rows if str(r.get("created_at") or "")[:10] <= date_to]

    outcomes = db.results_summary()
    # Review priority is clinician triage language; patients never see it.
    show_priority = principal.role != "patient"
    enriched = []
    for r in rows:
        outcome = outcomes.get(str(r["id"])) or {}
        enriched.append({
            **r,
            "analysis_type": canonical_analysis_type(r.get("analysis_type")),
            "prediction": canonical_prediction(outcome.get("prediction")),
            "confidence": outcome.get("confidence"),
            "review_priority": (
                review_priority(outcome.get("prediction"), outcome.get("confidence"))
                if show_priority else None
            ),
        })
    if prediction:
        enriched = [r for r in enriched if (r["prediction"] or "").upper() == prediction.upper()]
    if priority:
        enriched = [r for r in enriched if r["review_priority"] == priority]

    names = _display_names(db, hospital)
    if q:
        term = q.strip().lower()

        def _matches(row: dict) -> bool:
            fields = ("id", "modality", "status", "analysis_type", "prediction")
            if any(term in str(row.get(f) or "").lower() for f in fields):
                return True
            return any(
                term in names.get(str(row.get(f)), "").lower()
                for f in ("patient_id", "doctor_id")
            )

        enriched = [r for r in enriched if _matches(r)]
    return enriched, names


@router.get("", response_model=PaginatedResponse[SessionListItem])
def list_analyses(
    modality: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    patient_id: str | None = Query(default=None),
    doctor_id: str | None = Query(default=None),
    radiologist_id: str | None = Query(default=None),
    hospital_id: str | None = Query(default=None),
    mine: bool = Query(default=False),
    analysis_type: str | None = Query(default=None),
    prediction: str | None = Query(default=None, description="CN | MCI | AD"),
    priority: str | None = Query(default=None, description="routine | priority | urgent"),
    q: str | None = Query(default=None),
    date_from: str | None = Query(default=None, description="YYYY-MM-DD, inclusive"),
    date_to: str | None = Query(default=None, description="YYYY-MM-DD, inclusive"),
    sort: str = Query(default="newest", description="newest | oldest | patient_asc | patient_desc | confidence_desc"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[SessionListItem]:
    """Role-scoped list of analysis sessions the caller may see (doc 8.5)."""
    rows, names = _enriched_sessions(
        principal, db,
        modality=modality, status_filter=status_filter, patient_id=patient_id,
        doctor_id=doctor_id, radiologist_id=radiologist_id, hospital_id=hospital_id,
        mine=mine, analysis_type=analysis_type, prediction=prediction,
        priority=priority, q=q, date_from=date_from, date_to=date_to,
    )
    sort = sort if sort in _SORTS else "newest"
    if sort in ("newest", "oldest"):
        rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=sort == "newest")
    elif sort == "confidence_desc":
        rows.sort(key=lambda r: r.get("confidence") or -1.0, reverse=True)
    else:
        rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
        rows.sort(
            key=lambda r: names.get(str(r.get("patient_id")), "").lower(),
            reverse=sort == "patient_desc",
        )
    total = len(rows)
    page = rows[offset : offset + limit]
    return PaginatedResponse(
        items=[_to_list_item(r, names) for r in page], total=total, limit=limit, offset=offset
    )


@router.get("/stats", response_model=AnalysisStatsResponse)
def analysis_stats(
    range_: str = Query(default="all", alias="range", description="today | week | month | quarter | all"),
    trend: str = Query(default="8w", description="8w | 12w | 6m | 12m"),
    modality: str | None = Query(default=None),
    analysis_type: str | None = Query(default=None),
    doctor_id: str | None = Query(default=None),
    radiologist_id: str | None = Query(default=None),
    hospital_id: str | None = Query(default=None),
    mine: bool = Query(default=False),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> AnalysisStatsResponse:
    """Counts by status/modality/prediction/priority for a preset range, plus a
    diagnosis-and-modality trend series, over the sessions the caller may read."""
    from datetime import date, timedelta

    from app.services.triage import TIERS

    range_ = range_ if range_ in _STATS_RANGES else "all"
    grain, count = _TREND_SPANS.get(trend, _TREND_SPANS["8w"])
    rows, _ = _enriched_sessions(
        principal, db,
        modality=modality, analysis_type=analysis_type, doctor_id=doctor_id,
        radiologist_id=radiologist_id, hospital_id=hospital_id, mine=mine,
    )

    today = date.today()
    days_back = _STATS_RANGES[range_]
    if days_back is not None:
        start = (today - timedelta(days=days_back)).isoformat()
        in_range = [r for r in rows if str(r.get("created_at") or "")[:10] >= start]
    else:
        in_range = rows

    def _count(key: str, keys: tuple[str, ...] = ()) -> dict[str, int]:
        out = {k: 0 for k in keys}
        for r in in_range:
            v = r.get(key)
            if v:
                out[v] = out.get(v, 0) + 1
        return out

    completed = [r for r in in_range if r.get("status") == SessionStatus.completed.value]
    by_prediction = {"CN": 0, "MCI": 0, "AD": 0}
    by_priority = {t: 0 for t in TIERS}
    for r in completed:
        if r.get("prediction"):
            by_prediction[r["prediction"]] = by_prediction.get(r["prediction"], 0) + 1
        if r.get("review_priority"):
            by_priority[r["review_priority"]] += 1

    # Trend buckets: calendar weeks (Mon-Sun) or calendar months, oldest first.
    buckets: list[TrendBucket] = []
    if grain == "week":
        week_start = today - timedelta(days=today.weekday())
        for i in range(count - 1, -1, -1):
            s = week_start - timedelta(weeks=i)
            e = s + timedelta(days=6)
            label = f"{s.day} {s.strftime('%b')}"
            buckets.append(TrendBucket(label=label, start=s.isoformat(), end=e.isoformat()))
    else:
        y, m = today.year, today.month
        months = []
        for _ in range(count):
            months.append((y, m))
            y, m = (y - 1, 12) if m == 1 else (y, m - 1)
        for y, m in reversed(months):
            s = date(y, m, 1)
            e = (date(y + (m == 12), 1 if m == 12 else m + 1, 1) - timedelta(days=1))
            buckets.append(TrendBucket(label=s.strftime("%b %Y"), start=s.isoformat(), end=e.isoformat()))

    for r in rows:
        day = str(r.get("created_at") or "")[:10]
        if not day:
            continue
        for b in buckets:
            if b.start <= day <= b.end:
                b.total += 1
                mod = r.get("modality")
                if mod:
                    b.by_modality[mod] = b.by_modality.get(mod, 0) + 1
                pred = r.get("prediction")
                if pred and r.get("status") == SessionStatus.completed.value:
                    b.by_prediction[pred] = b.by_prediction.get(pred, 0) + 1
                break

    return AnalysisStatsResponse(
        range=range_,
        total=len(in_range),
        by_status=_count("status"),
        by_modality=_count("modality", ("mri", "eeg")),
        by_prediction=by_prediction,
        by_priority=by_priority,
        by_analysis_type=_count("analysis_type"),
        trend_grain=grain,
        trend=buckets,
    )


@router.get("/{session_id}", response_model=SessionStatusResponse)
def get_status(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> SessionStatusResponse:
    session = _require_session(db, session_id)
    _require_read(principal, session)
    return _to_status(session)


@router.get("/{session_id}/result", response_model=AnalysisResultResponse)
def get_result(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
    storage: StorageService = Depends(get_storage),
) -> AnalysisResultResponse:
    session = _require_session(db, session_id)
    _require_read(principal, session)
    result = db.get_result(session_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "result_not_ready", "message": "Result not available yet."},
        )
    reports = db.get_reports(session_id) or {}
    visualizations = result.get("visualizations") or {}
    # Re-sign explainability image URLs (signed URLs expire ~1h after write).
    if visualizations.get("explainability"):
        visualizations = {
            **visualizations,
            "explainability": storage.refresh_explainability(visualizations["explainability"]),
        }
    # report_urls are signed PDF links; only include them once this caller is
    # actually allowed to see reports (patients need doctor approval first —
    # /result must not leak them ahead of the /reports gate).
    report_urls = ReportUrls()
    try:
        _require_report_access_approved(principal, db)
        report_urls = _report_urls(reports, storage)
    except HTTPException:
        pass
    return AnalysisResultResponse(
        session_id=session_id,
        modality=session["modality"],
        analysis_type=session["analysis_type"],
        prediction=result["prediction"],
        confidence=result.get("confidence"),
        probabilities=result.get("probabilities") or {},
        metrics=result.get("metrics") or {},
        similarity=result.get("similarity") or {},
        consistency=result.get("consistency") or {},
        visualizations=visualizations,
        model_version=result.get("model_version"),
        report_urls=report_urls,
    )


@router.get("/{session_id}/reports", response_model=ReportsResponse)
def get_reports(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
    storage: StorageService = Depends(get_storage),
) -> ReportsResponse:
    session = _require_session(db, session_id)
    if not permissions.can_read_report(
        principal.user_id, principal.role, principal.hospital_id, session
    ):
        raise _forbid("You do not have access to these reports.")

    _require_report_access_approved(principal, db)

    reports = db.get_reports(session_id) or {}
    return ReportsResponse(
        session_id=session_id,
        report_urls=_report_urls(reports, storage),
        asset_urls=reports.get("asset_urls") or {},
    )


@router.post("/{session_id}/retry", response_model=RetryResponse)
def retry_analysis(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> RetryResponse:
    session = _require_session(db, session_id)
    if not permissions.can_retry_session(
        principal.user_id, principal.role, principal.hospital_id, session
    ):
        raise _forbid("You may not retry this analysis.")
    if session["status"] not in {SessionStatus.failed.value, SessionStatus.cancelled.value}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "retry_not_allowed",
                "message": f"Cannot retry a session in status {session['status']!r}.",
            },
        )
    retry_count = db.increment_retry(session_id)
    get_job_service().enqueue_analysis(session_id)
    return RetryResponse(
        session_id=session_id, status=SessionStatus.queued.value, retry_count=retry_count
    )


@router.post("/{session_id}/cancel", response_model=CancelResponse)
def cancel_analysis(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> CancelResponse:
    """Cancel an in-flight analysis. Same permission as retry (care team /
    admins, not the patient). Only valid from queued/processing — a session
    already terminal (completed/failed/cancelled) 409s, matching retry's
    status-guard pattern."""
    session = _require_session(db, session_id)
    if not permissions.can_retry_session(
        principal.user_id, principal.role, principal.hospital_id, session
    ):
        raise _forbid("You may not cancel this analysis.")
    if session["status"] not in {SessionStatus.queued.value, SessionStatus.processing.value}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "cancel_not_allowed",
                "message": f"Cannot cancel a session in status {session['status']!r}.",
            },
        )
    db.update_session_stage(session_id, status=SessionStatus.cancelled.value)
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=session.get("hospital_id"),
        action="analysis.cancel",
        target_table="analysis_sessions",
        target_id=session_id,
    )
    return CancelResponse(session_id=session_id, status=SessionStatus.cancelled.value)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_analysis(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> None:
    """Delete an analysis session (Care team & admins)."""
    session = _require_session(db, session_id)
    if not permissions.can_retry_session(
        principal.user_id, principal.role, principal.hospital_id, session
    ):
        raise _forbid("You may not delete this analysis session.")
    db.delete_session(session_id)


def _build_pipeline_options(
    modality: str,
    channel_index: int | None,
    scan_metadata_json: str | None,
    eeg_metadata_json: str | None,
) -> dict:
    """Assemble the modality-specific options bag persisted on the session."""
    options: dict = {}
    if modality == Modality.eeg.value and channel_index is not None:
        options["channel_index"] = channel_index
    if modality == Modality.eeg.value and eeg_metadata_json:
        try:
            options["eeg_metadata"] = json.loads(eeg_metadata_json)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "invalid_eeg_metadata",
                    "message": "eeg_metadata_json must be valid JSON.",
                },
            )
    if modality == Modality.mri.value and scan_metadata_json:
        try:
            options["scan_metadata"] = json.loads(scan_metadata_json)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "invalid_scan_metadata",
                    "message": "scan_metadata_json must be valid JSON.",
                },
            )
    return options


def _to_status(session: dict) -> SessionStatusResponse:
    return SessionStatusResponse(
        id=str(session["id"]),
        modality=session["modality"],
        analysis_type=session["analysis_type"],
        patient_id=str(session.get("patient_id")) if session.get("patient_id") else None,
        doctor_id=str(session.get("doctor_id")) if session.get("doctor_id") else None,
        status=session["status"],
        current_stage=session.get("current_stage"),
        progress_percent=session.get("progress_percent", 0) or 0,
        error_message=session.get("error_message"),
        created_at=session.get("created_at"),
        updated_at=session.get("updated_at"),
    )


def _to_list_item(row: dict, names: dict[str, str]) -> SessionListItem:
    base = _to_status(row).model_dump()
    return SessionListItem(
        **base,
        radiologist_id=str(row["radiologist_id"]) if row.get("radiologist_id") else None,
        patient_name=names.get(str(row.get("patient_id"))) or None,
        doctor_name=names.get(str(row.get("doctor_id"))) or None,
        prediction=row.get("prediction"),
        confidence=row.get("confidence"),
        review_priority=row.get("review_priority"),
    )


def _require_session(db: DatabaseService, session_id: str) -> dict:
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": "Analysis session not found."},
        )
    return session


def _require_read(principal: Principal, session: dict) -> None:
    if not permissions.can_read_session(
        principal.user_id, principal.role, principal.hospital_id, session
    ):
        raise _forbid("You do not have access to this analysis session.")


def _require_report_access_approved(principal: Principal, db: DatabaseService) -> None:
    """A patient may only see report PDF URLs once their assigned doctor has
    approved their report-access request (doc: report access flow). Other
    roles (doctor/radiologist/admin/super_admin) are unaffected. Must be
    called by every endpoint that returns ``report_urls`` to a patient."""
    if principal.role != "patient":
        return
    grant = db.get_report_access_by_patient(principal.user_id)
    if not grant or grant.get("status") != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "report_access_pending",
                "message": "Your doctor has not yet approved your request to view reports.",
            },
        )


def _forbid(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "permission_denied", "message": message},
    )


def _report_urls(reports: dict, storage: StorageService) -> ReportUrls:
    # Report PDFs are generated once and their signed URL stored as-is; the
    # embedded JWT expires ~1h after generation (see StorageService.
    # refresh_signed_url). Re-sign on every read so a report viewed long
    # after it was generated doesn't fail with an expired-token error.
    return ReportUrls(
        patient=storage.refresh_signed_url(reports.get("patient_pdf_url")),
        clinician=storage.refresh_signed_url(reports.get("clinician_pdf_url")),
        technical=storage.refresh_signed_url(reports.get("technical_pdf_url")),
    )
