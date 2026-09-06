"""Download model checkpoints from Cloudflare R2 to platform/backend/models."""

import os
from pathlib import Path

import boto3

# ---- Replace these with your actual credentials ----
ACCESS_KEY = os.environ.get("AWS_ACCESS_KEY_ID", "REPLACE_ME")
SECRET_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "REPLACE_ME")
ENDPOINT = "https://f3c30aedba5fd75851f5f721d11b77a6.r2.cloudflarestorage.com"
BUCKET = "ai4neuro-models"
# -----------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_DIR = SCRIPT_DIR.parent / "backend" / "models"

s3 = boto3.client(
    "s3",
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name="auto",
)


def sync_prefix(prefix: str, local_dir: Path):
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            rel = key[len(prefix):].lstrip("/")
            if not rel:
                continue
            dest = local_dir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            size_mb = obj["Size"] / (1024 * 1024)
            print(f"  {key} -> {dest} ({size_mb:.1f} MB)")
            s3.download_file(BUCKET, key, str(dest))


print(f"Downloading to {MODEL_DIR}\n")

print("=== EEG checkpoints ===")
sync_prefix("eeg/checkpoints", MODEL_DIR / "eeg" / "checkpoints")

print("\n=== EEG reference files ===")
sync_prefix("eeg/reference", MODEL_DIR / "eeg" / "reference")

print("\n=== MRI models ===")
sync_prefix("mri", MODEL_DIR / "mri")

print("\nDone. Set these in backend/.env:")
print(f"  EEG_CHECKPOINT_ROOT={MODEL_DIR / 'eeg' / 'checkpoints'}")
print(f"  EEG_REFERENCE_DIR={MODEL_DIR / 'eeg' / 'reference'}")
print(f"  CONVIT_CHECKPOINT_PATH={MODEL_DIR / 'mri' / 'ConVit_checkpoint.pth'}")
