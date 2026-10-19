"""Firebase client factory + the adapter the rest of the backend talks to.

The backend was written against supabase-py's query builder
(``client.table(name).select("*").eq(col, val).execute()``) and storage API
(``client.storage.from_(bucket).upload(...)``). Rather than rewrite every call
site, this module puts **that same small surface** over Firestore and Cloud
Storage. ``DatabaseService`` / ``StorageService`` and the routes are unchanged.

Mapping:
  * table ``x``          -> Firestore collection ``neuro_x`` (flat, one doc per row)
  * primary key          -> document id (``id``, or the column in ``_KEY_COLUMN``)
  * storage "bucket" ``b``-> prefix ``b/`` inside the one Firebase Storage bucket

Firestore has no SQL defaults, cascades or unique constraints. Defaults that the
code relies on live in ``_DEFAULTS``; one-row-per-parent tables are keyed by the
parent id so they stay unique; cascades are done explicitly by the caller.

Returns ``None`` from ``get_service_client`` when Firebase is not configured, so
the app still boots for local dev + tests without credentials.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

COLLECTION_PREFIX = "neuro_"

# Tables whose primary key is not ``id``. Keying results/reports by session and
# report-access by patient also enforces the one-per-parent rule Postgres did
# with unique indexes.
_KEY_COLUMN = {
    "patient_profiles": "user_id",
    "doctor_profiles": "user_id",
    "radiologist_profiles": "user_id",
    "hospital_admin_profiles": "user_id",
    "super_admin_profiles": "user_id",
    "analysis_results": "session_id",
    "analysis_reports": "session_id",
    "report_access_requests": "patient_id",
}

# Column defaults Postgres used to apply on insert.
_DEFAULTS: dict[str, dict[str, Any]] = {
    "user_profiles": {"account_status": "pending", "auth_provider": "email"},
    "patient_profiles": {"verification_status": "pending"},
    "doctor_profiles": {"verification_status": "pending", "is_active": True},
    "radiologist_profiles": {"verification_status": "pending", "experience_years": 0},
    "doctor_patient_relationships": {"relationship_status": "active"},
    "analysis_sessions": {"retry_count": 0, "progress_percent": 0},
    "job_events": {"level": "info"},
}

_IN_CHUNK = 30  # Firestore's limit on values in one `in` filter
_BATCH_LIMIT = 450  # Firestore allows 500 writes per batch


class FirebaseNotConfiguredError(RuntimeError):
    """Raised when an operation needs Firebase but it is not configured."""


def require_client(client: Any | None) -> Any:
    if client is None:
        raise FirebaseNotConfiguredError(
            "Firebase is not configured. Set FIREBASE_PROJECT_ID and "
            "FIREBASE_CREDENTIALS_PATH."
        )
    return client


@lru_cache
def get_service_client() -> Any | None:
    """Build (once) the Firebase-backed client, or None if not configured."""
    settings = get_settings()
    if not settings.firebase_project_id:
        # LEGACY fallback (delete at cut-over): an un-migrated local setup that
        # still has Supabase keys keeps working until Firebase is configured.
        if settings.supabase_url and settings.supabase_service_role_key:
            from app.services.supabase_client import get_service_client as legacy_client

            logger.warning("FIREBASE_PROJECT_ID unset; using the legacy Supabase client.")
            return legacy_client()
        logger.warning("Firebase not configured; DB/storage operations disabled.")
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore, storage

        options = {
            "projectId": settings.firebase_project_id,
            "storageBucket": settings.firebase_storage_bucket
            or f"{settings.firebase_project_id}.firebasestorage.app",
        }
        cred = (
            credentials.Certificate(settings.firebase_credentials_path)
            if settings.firebase_credentials_path
            else credentials.ApplicationDefault()
        )
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred, options)
        return FirebaseClient(firestore.client(), storage.bucket())
    except Exception as exc:
        logger.error("Failed to initialize Firebase: %s", exc)
        return None


class _Result:
    def __init__(self, data: Any) -> None:
        self.data = data


# Firestore rejects arrays nested directly inside arrays, which pipeline output
# (matrices, per-trial lists) contains. Such values are stored as a JSON string
# and restored on read; everything else stays a native, queryable field.
_JSON_MARK = "__json__"


def _has_nested_array(value: Any, in_array: bool = False) -> bool:
    if isinstance(value, (list, tuple)):
        return in_array or any(_has_nested_array(v, True) for v in value)
    if isinstance(value, dict):
        return any(_has_nested_array(v) for v in value.values())
    return False


def _encode(row: dict) -> dict:
    return {
        k: {_JSON_MARK: json.dumps(v, default=str)} if _has_nested_array(v) else v
        for k, v in row.items()
    }


def _decode(row: dict | None) -> dict | None:
    if row is None:
        return None
    return {
        k: json.loads(v[_JSON_MARK]) if isinstance(v, dict) and set(v) == {_JSON_MARK} else v
        for k, v in row.items()
    }


class _TableQuery:
    """One supabase-style query against one Firestore collection."""

    def __init__(self, fs: Any, table: str) -> None:
        self._fs = fs
        self._table = table
        self._key = _KEY_COLUMN.get(table, "id")
        self._col = fs.collection(COLLECTION_PREFIX + table)
        self._op = "select"
        self._payload: dict = {}
        self._fields: list[str] | None = None
        self._eq: list[tuple[str, Any]] = []
        self._neq: list[tuple[str, Any]] = []
        self._in: list[tuple[str, list]] = []
        self._order: str | None = None
        self._single = False

    # ---- builders ----
    def insert(self, row: dict) -> "_TableQuery":
        self._op, self._payload = "insert", dict(row)
        return self

    def upsert(self, row: dict, on_conflict: str | None = None) -> "_TableQuery":
        self._op, self._payload = "upsert", dict(row)
        return self

    def update(self, patch: dict) -> "_TableQuery":
        self._op, self._payload = "update", dict(patch)
        return self

    def delete(self) -> "_TableQuery":
        self._op = "delete"
        return self

    def select(self, columns: str = "*") -> "_TableQuery":
        self._op = "select"
        if columns and columns.strip() != "*":
            self._fields = [c.strip() for c in columns.split(",")]
        return self

    def eq(self, col: str, val: Any) -> "_TableQuery":
        self._eq.append((col, val))
        return self

    def neq(self, col: str, val: Any) -> "_TableQuery":
        self._neq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_TableQuery":
        self._in.append((col, list(vals)))
        return self

    def order(self, col: str) -> "_TableQuery":
        self._order = col
        return self

    def maybe_single(self) -> "_TableQuery":
        self._single = True
        return self

    single = maybe_single

    # ---- execution ----
    def execute(self) -> _Result:
        if self._op in ("insert", "upsert"):
            return _Result([self._write()])

        matched = self._matching()  # [(doc_ref, row)]

        if self._op == "update":
            self._commit((("update", ref, _encode(self._payload)) for ref, _ in matched))
            return _Result([{**row, **self._payload} for _, row in matched])

        if self._op == "delete":
            self._commit((("delete", ref, None) for ref, _ in matched))
            return _Result([row for _, row in matched])

        rows = [row for _, row in matched]
        if self._order:
            rows.sort(key=lambda r: r.get(self._order) or 0)
        if self._single:
            return _Result(rows[0] if rows else None)
        return _Result(rows)

    def _write(self) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        row = {**_DEFAULTS.get(self._table, {}), **self._payload}
        row.setdefault("id", str(uuid.uuid4()))
        doc = self._col.document(str(row[self._key]))
        if self._op == "upsert":
            existing = doc.get()
            if existing.exists:
                row = {**(_decode(existing.to_dict()) or {}), **self._payload}
        row.setdefault("created_at", now)
        row.setdefault("updated_at", now)
        doc.set(_encode(row))
        return row

    def _matching(self) -> list[tuple[Any, dict]]:
        """Resolve the filters to ``(doc_ref, row)`` pairs.

        A filter on the key column is a direct document read. Otherwise every
        equality filter is pushed to Firestore (equality-only queries need no
        composite index) and ``neq`` / remaining ``in_`` are applied here.
        """
        key_eq = next((v for c, v in self._eq if c == self._key), None)
        key_in = next((vals for c, vals in self._in if c == self._key), None)

        if key_eq is not None:
            snaps = [self._col.document(str(key_eq)).get()]
        elif key_in is not None:
            refs = [self._col.document(str(v)) for v in key_in]
            snaps = list(self._fs.get_all(refs)) if refs else []
        else:
            snaps = self._query()

        out = []
        for snap in snaps:
            if not snap.exists:
                continue
            row = _decode(snap.to_dict()) or {}
            if (
                all(row.get(c) == v for c, v in self._eq)
                and all(row.get(c) != v for c, v in self._neq)
                and all(row.get(c) in vals for c, vals in self._in)
            ):
                out.append((snap.reference, row))
        return out

    def _query(self) -> list[Any]:
        from google.cloud.firestore_v1.base_query import FieldFilter

        base = self._col
        for col, val in self._eq:
            base = base.where(filter=FieldFilter(col, "==", val))
        # Projection only helps plain selects with no client-side filters.
        if self._op == "select" and self._fields and not self._neq and not self._in:
            base = base.select(self._fields)

        if not self._in:
            return list(base.stream())

        # Push the first `in` filter to Firestore in chunks; any others are
        # applied in Python by the caller.
        col, vals = self._in[0]
        snaps: list[Any] = []
        for i in range(0, len(vals), _IN_CHUNK):
            chunk = vals[i : i + _IN_CHUNK]
            snaps.extend(base.where(filter=FieldFilter(col, "in", chunk)).stream())
        return snaps

    def _commit(self, ops: Any) -> None:
        batch, pending = self._fs.batch(), 0
        for kind, ref, patch in ops:
            if kind == "update":
                batch.update(ref, patch)
            else:
                batch.delete(ref)
            pending += 1
            if pending >= _BATCH_LIMIT:
                batch.commit()
                batch, pending = self._fs.batch(), 0
        if pending:
            batch.commit()


class _BucketOps:
    """supabase-style storage calls against a prefix of the Firebase bucket."""

    def __init__(self, bucket: Any, prefix: str) -> None:
        self._bucket = bucket
        self._prefix = prefix

    def _blob(self, path: str) -> Any:
        return self._bucket.blob(f"{self._prefix}/{path.lstrip('/')}")

    def upload(self, path: str, data: bytes, file_options: dict | None = None) -> dict:
        content_type = (file_options or {}).get("content-type", "application/octet-stream")
        self._blob(path).upload_from_string(bytes(data), content_type=content_type)
        return {"path": path}

    def download(self, path: str) -> bytes:
        return self._blob(path).download_as_bytes()

    def create_signed_url(self, path: str, expires_in: int = 3600) -> dict:
        url = self._blob(path).generate_signed_url(
            version="v4", expiration=timedelta(seconds=expires_in), method="GET"
        )
        return {"signedURL": url}


class _Storage:
    def __init__(self, bucket: Any) -> None:
        self._bucket = bucket

    def from_(self, bucket: str) -> _BucketOps:
        return _BucketOps(self._bucket, bucket)


class FirebaseClient:
    """What ``DatabaseService`` and ``StorageService`` receive as ``client``."""

    def __init__(self, firestore_client: Any, bucket: Any) -> None:
        self._fs = firestore_client
        self.storage = _Storage(bucket)

    def table(self, name: str) -> _TableQuery:
        return _TableQuery(self._fs, name)
