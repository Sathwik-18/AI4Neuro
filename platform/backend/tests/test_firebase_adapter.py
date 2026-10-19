"""Behaviours specific to the Firebase adapter (the rest of the suite already
runs through it via the parametrised ``fake_supabase`` fixture)."""

from __future__ import annotations

from app.pipelines.base import PipelineResult
from app.services.database import DatabaseService
from app.services.firebase_client import COLLECTION_PREFIX, FirebaseClient
from app.services.storage import StorageService
from tests.fake_firestore import FakeBucket, FakeFirestore


def _client() -> tuple[FirebaseClient, FakeFirestore, FakeBucket]:
    fs, bucket = FakeFirestore(), FakeBucket()
    return FirebaseClient(fs, bucket), fs, bucket


def test_nested_arrays_round_trip():
    """Firestore rejects arrays of arrays; pipeline output is full of them."""
    client, fs, _ = _client()
    db = DatabaseService(client=client)
    result = PipelineResult(
        prediction="MCI",
        confidence=0.5,
        probabilities={"CN": 0.4, "MCI": 0.5, "AD": 0.1},
        metrics={"confusion": [[1, 2], [3, 4]], "plain": [1, 2, 3]},
        consistency={"trial_predictions": [0, 1, 1]},
    )
    db.insert_result("s1", result)  # would raise inside the fake without encoding
    stored = db.get_result("s1")
    assert stored["metrics"] == {"confusion": [[1, 2], [3, 4]], "plain": [1, 2, 3]}
    assert stored["probabilities"]["MCI"] == 0.5
    # one result per session: keyed by session id
    assert list(fs.collections[COLLECTION_PREFIX + "analysis_results"]) == ["s1"]


def test_defaults_and_generated_ids():
    client, _, _ = _client()
    row = client.table("user_profiles").insert({"id": "uid1", "email": "a@b.c"}).execute().data[0]
    assert row["account_status"] == "pending" and row["created_at"]
    session = client.table("analysis_sessions").insert({"modality": "mri"}).execute().data[0]
    assert session["id"] and session["retry_count"] == 0


def test_in_filter_over_firestore_chunk_limit():
    client, _, _ = _client()
    for i in range(70):
        client.table("job_events").insert({"session_id": f"s{i}", "message": "m"}).execute()
    wanted = [f"s{i}" for i in range(65)]
    rows = client.table("job_events").select("*").in_("session_id", wanted).execute().data
    assert len(rows) == 65
    deleted = client.table("job_events").delete().in_("session_id", wanted).execute().data
    assert len(deleted) == 65
    assert len(client.table("job_events").select("*").execute().data) == 5


def test_upsert_merges_and_update_of_missing_row_is_a_noop():
    client, _, _ = _client()
    client.table("doctor_profiles").upsert({"user_id": "d1", "specialization": "Neuro"}, on_conflict="user_id").execute()
    client.table("doctor_profiles").upsert({"user_id": "d1", "medical_license": "L1"}, on_conflict="user_id").execute()
    row = client.table("doctor_profiles").select("*").eq("user_id", "d1").maybe_single().execute().data
    assert row["specialization"] == "Neuro" and row["medical_license"] == "L1"
    assert client.table("doctor_profiles").update({"x": 1}).eq("user_id", "nope").execute().data == []


def test_hard_delete_hospital_removes_children_without_cascades():
    client, fs, _ = _client()
    db = DatabaseService(client=client)
    for hid in ("H1", "H2"):
        db.create_hospital({"id": hid, "name": hid})
        db.create_user_profile({"id": f"u-{hid}", "hospital_id": hid, "role": "patient", "email": f"{hid}@x"})
        db.create_role_profile("patient_profiles", {"user_id": f"u-{hid}"})
        s = db.create_session(modality="mri", analysis_type="multiclass", original_filename="a.nii", hospital_id=hid)
        db.insert_result(s["id"], PipelineResult(prediction="CN", confidence=0.9))
        db.insert_reports(s["id"], patient_pdf_url="u")
        db.insert_job_event(s["id"], message="started")

    assert db.hard_delete_hospital("H1") == ["u-H1"]

    def remaining(table: str) -> int:
        return len(fs.collections.get(COLLECTION_PREFIX + table, {}))

    # H2 is untouched; every H1 child is gone.
    for table in ("hospitals", "user_profiles", "patient_profiles", "analysis_sessions",
                  "analysis_results", "analysis_reports", "job_events"):
        assert remaining(table) == 1, table


def test_signed_url_refresh_understands_cloud_storage_urls():
    client, _, bucket = _client()
    storage = StorageService(client=client)
    url = storage.upload_bytes(bucket="reports", path="s1/patient report.pdf", data=b"%PDF", content_type="application/pdf")
    assert "reports/s1/patient report.pdf" in bucket.objects
    refreshed = storage.refresh_signed_url(url.replace(" ", "%20"))
    assert refreshed != url and "/reports/s1/patient report.pdf" in refreshed
