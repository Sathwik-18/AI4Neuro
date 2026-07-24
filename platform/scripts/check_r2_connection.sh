#!/usr/bin/env bash
set -euo pipefail

# Verifies that the current machine can access the AI4NEURO model artifacts in
# Cloudflare R2 / S3-compatible object storage. This script does not download
# model checkpoints.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODEL_SYNC_ENV="${MODEL_SYNC_ENV:-${PLATFORM_DIR}/model-sync.env}"

if [[ -f "${MODEL_SYNC_ENV}" ]]; then
  # shellcheck disable=SC1090
  source "${MODEL_SYNC_ENV}"
fi

MODEL_BUCKET="${MODEL_BUCKET:?Set MODEL_BUCKET, for example ai4neuro-models}"
MODEL_ENDPOINT_URL="${MODEL_ENDPOINT_URL:?Set MODEL_ENDPOINT_URL for R2/Oracle S3 compatibility}"
MODEL_PREFIX="${MODEL_PREFIX:-ai4neuro}"

if ! command -v aws >/dev/null 2>&1; then
  echo "FAIL: aws CLI is required. Install AWS CLI first." >&2
  exit 1
fi

prefix_path() {
  local suffix="$1"
  if [[ -n "${MODEL_PREFIX}" ]]; then
    printf '%s/%s' "${MODEL_PREFIX%/}" "${suffix#/}"
  else
    printf '%s' "${suffix#/}"
  fi
}

check_prefix_has_checkpoint() {
  local label="$1"
  local prefix="$2"
  local output

  if ! output="$(aws s3 ls "s3://${MODEL_BUCKET}/$(prefix_path "${prefix}")" \
    --recursive \
    --endpoint-url "${MODEL_ENDPOINT_URL}")"; then
    echo "FAIL: cannot read ${label} prefix: s3://${MODEL_BUCKET}/$(prefix_path "${prefix}")" >&2
    return 1
  fi

  if ! grep -q "checkpoint.pth" <<<"${output}"; then
    echo "FAIL: ${label} checkpoint.pth not found under s3://${MODEL_BUCKET}/$(prefix_path "${prefix}")" >&2
    return 1
  fi

  echo "OK: ${label}"
  grep "checkpoint.pth" <<<"${output}" | sed 's/^/  /'
}

echo "Checking AI4NEURO R2 access..."
echo "Bucket: ${MODEL_BUCKET}"
echo "Prefix: ${MODEL_PREFIX}"
echo "Endpoint: ${MODEL_ENDPOINT_URL}"
echo

echo "Checking bucket/prefix visibility..."
aws s3 ls "s3://${MODEL_BUCKET}/$(prefix_path "")" \
  --endpoint-url "${MODEL_ENDPOINT_URL}" >/dev/null
echo "OK: bucket and prefix are reachable"

echo
echo "Checking expected model artifacts..."

aws s3 ls "s3://${MODEL_BUCKET}/$(prefix_path mri/ConVit_checkpoint.pth)" \
  --endpoint-url "${MODEL_ENDPOINT_URL}" >/dev/null
echo "OK: MRI ConVit checkpoint"
aws s3 ls "s3://${MODEL_BUCKET}/$(prefix_path mri/ConVit_checkpoint.pth)" \
  --endpoint-url "${MODEL_ENDPOINT_URL}" | sed 's/^/  /'

check_prefix_has_checkpoint "EEG Binary ADSZ-Indep checkpoint" \
  "eeg/checkpoints/classification/ADSZ-Indep"

check_prefix_has_checkpoint "EEG Multiclass ADFD-Indep checkpoint" \
  "eeg/checkpoints/classification/ADFD-Indep"

echo
echo "R2 connection check passed. This machine can access the AI4NEURO checkpoints."
