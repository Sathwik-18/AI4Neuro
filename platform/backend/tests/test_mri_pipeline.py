"""MRI pipeline tests (binary + multiclass, no mock fallback).

The pipeline has no mock
fallback: without a real, loadable MRI checkpoint, it must fail loudly
(raise) instead of returning a fabricated prediction. Checkpoint-focused
tests force USE_CAT12_PREPROCESSING off so they isolate that failure mode
from CAT12 (which would otherwise fail first against these tests' synthetic
placeholder NIfTI, for an unrelated reason, whenever CAT12 is enabled
locally). The viewer-slice test builds a small synthetic NIfTI with nibabel
to exercise the real (Supabase-decoupled) slice extraction + upload path,
which is independent of the model.
"""

from __future__ import annotations

import os

import numpy as np
import pytest

# The MRI runner needs matplotlib (charts). Skip the module if absent.
pytest.importorskip("matplotlib")

from app.pipelines.base import AnalysisContext  # noqa: E402


def _make_context(base_dir, filename: str, analysis_type: str, sid: str) -> AnalysisContext:
    """Build a context around a small but valid synthetic NIfTI (so slice extraction succeeds
    and the model-availability check is what's actually under test)."""
    nib = pytest.importorskip("nibabel")
    work_dir = os.path.join(str(base_dir), sid)
    os.makedirs(work_dir, exist_ok=True)
    path = os.path.join(work_dir, filename)
    vol = (np.random.rand(24, 24, 24) * 255).astype(np.float32)
    nib.save(nib.Nifti1Image(vol, affine=np.eye(4)), path)
    return AnalysisContext(
        session_id=sid,
        modality="mri",
        analysis_type=analysis_type,
        local_input_path=path,
        original_filename=filename,
        patient_id="11111111-1111-1111-1111-111111111111",
    )


def test_no_checkpoint_fails_loudly(tmp_path, monkeypatch):
    """Without a configured/loadable checkpoint, the pipeline must error, not fabricate a result."""
    from app.pipelines.mri import ml_runner
    from app.pipelines.mri.runner import run_mri_pipeline

    monkeypatch.setattr(ml_runner, "CONVIT_CHECKPOINT_PATH", "")
    monkeypatch.setattr(ml_runner, "USE_CAT12_PREPROCESSING", False)

    ctx = _make_context(tmp_path, "scan.nii.gz", "multiclass", "mri-no-checkpoint")
    with pytest.raises(RuntimeError, match="checkpoint"):
        run_mri_pipeline(ctx)


def test_binary_without_any_checkpoint_fails_loudly(tmp_path, monkeypatch):
    from app.pipelines.mri import ml_runner
    from app.pipelines.mri.runner import run_mri_pipeline

    monkeypatch.setattr(ml_runner, "CONVIT_CHECKPOINT_PATH", "")
    monkeypatch.setattr(ml_runner, "MRI_BINARY_CHECKPOINT_PATH", "")
    monkeypatch.setattr(ml_runner, "USE_CAT12_PREPROCESSING", False)

    ctx = _make_context(tmp_path, "scan.nii.gz", "binary", "mri-binary-request")
    with pytest.raises(RuntimeError, match="checkpoint"):
        run_mri_pipeline(ctx)


def test_multiclass_probabilities_pass_through():
    from app.pipelines.mri.ml_runner import _probabilities_for_analysis

    probs, derived = _probabilities_for_analysis({"AD": 0.5, "CN": 0.2, "MCI": 0.3}, "multiclass")
    assert list(probs) == ["CN", "MCI", "AD"]
    assert probs == pytest.approx({"CN": 0.2, "MCI": 0.3, "AD": 0.5})
    assert derived is False


def test_binary_from_three_class_model_is_renormalised_and_flagged():
    from app.pipelines.mri.ml_runner import _probabilities_for_analysis

    probs, derived = _probabilities_for_analysis({"AD": 0.5, "CN": 0.2, "MCI": 0.3}, "binary")
    assert list(probs) == ["CN", "AD"]
    assert probs == pytest.approx({"CN": 0.2 / 0.7, "AD": 0.5 / 0.7})
    assert derived is True


def test_binary_from_dedicated_binary_model_is_not_derived():
    from app.pipelines.mri.ml_runner import _probabilities_for_analysis

    probs, derived = _probabilities_for_analysis({"CN": 0.9, "AD": 0.1}, "binary")
    assert probs == pytest.approx({"CN": 0.9, "AD": 0.1})
    assert derived is False


def test_binary_model_cannot_serve_multiclass():
    from app.pipelines.mri.ml_runner import _probabilities_for_analysis

    with pytest.raises(ValueError, match="MCI"):
        _probabilities_for_analysis({"CN": 0.9, "AD": 0.1}, "multiclass")


def test_model_probabilities_follow_checkpoint_class_names():
    from app.pipelines.mri.ml_runner import _model_probabilities

    probs = _model_probabilities({"average_probabilities": {"CN": 75.0, "AD": 25.0}}, ["CN", "AD"])
    assert probs == pytest.approx({"CN": 0.75, "AD": 0.25})


def test_api_accepts_mri_binary_and_legacy_alias():
    from app.api.v1.analysis import _normalize_analysis_type

    assert _normalize_analysis_type("mri", "binary") == "binary"
    assert _normalize_analysis_type("mri", "ad-only") == "binary"
    assert _normalize_analysis_type("mri", "Multiclass") == "multiclass"
    assert _normalize_analysis_type("eeg", "binary") == "multiclass"


def test_viewer_slice_extraction_and_upload(tmp_path):
    """Real NIfTI → local per-orientation slices → uploaded via storage service."""
    nib = pytest.importorskip("nibabel")
    from app.pipelines.mri.ml.nifti_slicer import extract_viewer_slices_local
    from app.services.storage import StorageService
    from tests.fake_supabase import FakeSupabase

    # Build a small synthetic brain-ish volume.
    vol = (np.random.rand(24, 24, 24) * 255).astype(np.float32)
    nifti_path = os.path.join(str(tmp_path), "synthetic.nii.gz")
    nib.save(nib.Nifti1Image(vol, affine=np.eye(4)), nifti_path)

    slices = extract_viewer_slices_local(
        nifti_path, os.path.join(str(tmp_path), "viewer"), num_slices=4
    )
    assert set(slices.keys()) == {"axial", "sagittal", "coronal"}
    for orientation, paths in slices.items():
        assert paths and all(os.path.exists(p) for p in paths)

    storage = StorageService(client=FakeSupabase())
    urls = storage.upload_viewer_slices("sess-viewer", slices)
    assert set(urls.keys()) == {"axial", "sagittal", "coronal"}
    assert all(len(v) == len(slices[k]) for k, v in urls.items())
    assert all("/object/sign/viewer-slices/" in u for v in urls.values() for u in v)


def test_full_loop_via_orchestrator_fails_without_checkpoint(tmp_path, monkeypatch):
    """End to end via the orchestrator: no checkpoint configured -> session marked failed,
    not completed with a fabricated prediction."""
    from app.pipelines.base import register_pipeline
    from app.pipelines.mri import ml_runner
    from app.pipelines.mri.runner import run_mri_pipeline
    from app.services.database import DatabaseService
    from app.services.orchestrator import run_analysis_job
    from app.services.storage import StorageService
    from tests.fake_supabase import FakeSupabase

    monkeypatch.setattr(ml_runner, "CONVIT_CHECKPOINT_PATH", "")
    register_pipeline("mri", run_mri_pipeline)

    fake = FakeSupabase()
    db = DatabaseService(client=fake)
    storage = StorageService(client=fake)

    session = db.create_session(
        modality="mri",
        analysis_type="multiclass",
        original_filename="scan.nii.gz",
        patient_id="11111111-1111-1111-1111-111111111111",
    )
    sid = str(session["id"])
    bucket, path = storage.upload_raw_file(
        modality="mri", session_id=sid, filename="scan.nii.gz", data=b"fake-nifti"
    )
    db.set_raw_file(sid, path=path, bucket=bucket)

    run_analysis_job(sid, db=db, storage=storage)

    session = db.get_session(sid)
    assert session["status"] == "failed"
    assert db.get_result(sid) is None
