"""Review-priority triage, enriched/filterable session list, and /analysis/stats."""

from __future__ import annotations

from datetime import date

import pytest

from app.api.deps import get_current_user
from app.core.security import Principal
from app.pipelines.base import PipelineResult
from app.services.triage import review_priority


@pytest.mark.parametrize(
    "prediction, confidence, expected",
    [
        ("AD", 0.9, "urgent"),
        ("AD", 0.4, "priority"),
        ("MCI", 0.95, "priority"),
        ("CN", 0.8, "routine"),
        ("CN", 0.5, "priority"),
        ("Normal", 0.9, "routine"),
        (None, None, None),
    ],
)
def test_review_priority(prediction, confidence, expected):
    assert review_priority(prediction, confidence) == expected


def test_legacy_labels_are_normalised(client, db_service, fake_supabase):
    _session_with_result(db_service, prediction="Alzheimer's", confidence=0.9)
    _session_with_result(db_service, prediction="Normal", confidence=0.9)
    body = client.get("/api/v1/analysis/stats").json()
    assert body["by_prediction"] == {"CN": 1, "MCI": 0, "AD": 1}
    assert client.get("/api/v1/analysis?prediction=AD").json()["total"] == 1


def _session_with_result(db, *, prediction, confidence, modality="mri", patient_id="p1", status="completed"):
    s = db.create_session(
        modality=modality,
        analysis_type="multiclass",
        original_filename="scan.nii.gz",
        patient_id=patient_id,
        hospital_id="h1",
    )
    if status == "completed":
        db.insert_result(
            s["id"],
            PipelineResult(prediction=prediction, confidence=confidence, probabilities={prediction: confidence}),
        )
        db.mark_completed(s["id"])
    return s


def _seed_mix(db, fake_supabase):
    for profile in (
        {"id": "p1", "full_name": "Zara Khan", "role": "patient", "hospital_id": "h1"},
        {"id": "p2", "full_name": "Arjun Rao", "role": "patient", "hospital_id": "h1"},
    ):
        fake_supabase.table("user_profiles").insert(profile).execute()
    _session_with_result(db, prediction="AD", confidence=0.9, patient_id="p1")
    _session_with_result(db, prediction="CN", confidence=0.85, patient_id="p2")
    _session_with_result(db, prediction="MCI", confidence=0.7, modality="eeg", patient_id="p2")


def test_list_items_carry_outcome_priority_and_names(client, db_service, fake_supabase):
    _seed_mix(db_service, fake_supabase)
    items = client.get("/api/v1/analysis").json()["items"]
    by_pred = {i["prediction"]: i for i in items}
    assert by_pred["AD"]["review_priority"] == "urgent"
    assert by_pred["AD"]["patient_name"] == "Zara Khan"
    assert by_pred["CN"]["review_priority"] == "routine"
    assert by_pred["MCI"]["confidence"] == pytest.approx(0.7)


def test_list_filters_by_prediction_and_priority(client, db_service, fake_supabase):
    _seed_mix(db_service, fake_supabase)
    ad = client.get("/api/v1/analysis?prediction=AD").json()
    assert ad["total"] == 1 and ad["items"][0]["prediction"] == "AD"
    urgent = client.get("/api/v1/analysis?priority=urgent").json()
    assert [i["prediction"] for i in urgent["items"]] == ["AD"]
    by_name = client.get("/api/v1/analysis?q=arjun").json()
    assert by_name["total"] == 2


def test_list_sorts_by_patient_and_confidence(client, db_service, fake_supabase):
    _seed_mix(db_service, fake_supabase)
    names = [i["patient_name"] for i in client.get("/api/v1/analysis?sort=patient_asc").json()["items"]]
    assert names == sorted(names, key=str.lower)
    confs = [i["confidence"] for i in client.get("/api/v1/analysis?sort=confidence_desc").json()["items"]]
    assert confs == sorted(confs, reverse=True)


def test_stats_counts_and_trend(client, db_service, fake_supabase):
    _seed_mix(db_service, fake_supabase)
    _session_with_result(db_service, prediction="", confidence=0, status="failed")
    db_service.mark_failed(db_service.list_sessions()[-1]["id"], "boom")

    res = client.get("/api/v1/analysis/stats?range=all&trend=8w")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 4
    assert body["by_prediction"] == {"CN": 1, "MCI": 1, "AD": 1}
    assert body["by_priority"] == {"routine": 1, "priority": 1, "urgent": 1}
    assert body["by_modality"] == {"mri": 3, "eeg": 1}
    assert body["by_status"]["completed"] == 3 and body["by_status"]["failed"] == 1
    assert body["trend_grain"] == "week" and len(body["trend"]) == 8
    this_week = body["trend"][-1]
    assert this_week["end"] >= date.today().isoformat()
    assert this_week["total"] == 4
    assert this_week["by_prediction"] == {"AD": 1, "CN": 1, "MCI": 1}


def test_patients_never_see_review_priority(client, db_service, fake_supabase):
    _seed_mix(db_service, fake_supabase)
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="p1", role="patient", hospital_id="h1", is_dev=False
    )
    items = client.get("/api/v1/analysis").json()["items"]
    assert items and all(i["review_priority"] is None for i in items)
    stats = client.get("/api/v1/analysis/stats").json()
    assert sum(stats["by_priority"].values()) == 0


def test_stats_monthly_trend_and_scoping(client, db_service, fake_supabase):
    _seed_mix(db_service, fake_supabase)
    body = client.get("/api/v1/analysis/stats?trend=6m").json()
    assert body["trend_grain"] == "month" and len(body["trend"]) == 6

    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="someone-else", role="doctor", hospital_id="h1", is_dev=False
    )
    scoped = client.get("/api/v1/analysis/stats").json()
    assert scoped["total"] == 0
