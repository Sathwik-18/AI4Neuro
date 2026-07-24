# AI4NEURO Teammate Local Setup Handoff

Last updated: 2026-07-12.

Use this when another teammate clones the repo and needs the app running locally.
Oracle deployment and CAT12 are not required for this handoff.

## What You Must Share Privately

Do not send these in GitHub or public chat. Share through a private password
manager or secure team channel.

### 1. Supabase Values

Frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sb_publishable_or_anon_key>
```

Backend:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_or_service_role_key>
SUPABASE_JWT_SECRET=
```

For newer Supabase projects, `SUPABASE_JxWT_SECRET` can stay empty. The backend
verifies modern Supabase JWTs through JWKS.

### 2. Cloudflare R2 Model Sync Values

```env
AWS_ACCESS_KEY_ID=<r2_access_key_id>
AWS_SECRET_ACCESS_KEY=<r2_secret_access_key>
AWS_DEFAULT_REGION=auto
MODEL_BUCKET=ai4neuro-models
MODEL_PREFIX=ai4neuro
MODEL_ENDPOINT_URL=https://<cloudflare-account-id>.r2.cloudflarestorage.com
```

The R2 bucket already contains:

```text
ai4neuro/eeg/checkpoints/classification/ADSZ-Indep/.../checkpoint.pth
ai4neuro/eeg/checkpoints/classification/ADFD-Indep/.../checkpoint.pth
ai4neuro/eeg/checkpoints/classification/APAVA-Indep/.../checkpoint.pth
ai4neuro/mri/ConVit_checkpoint.pth
```

### 3. Test Login Accounts

Give teammates the demo/test account emails and passwords created in Supabase
Auth. Passwords are not stored in the database in readable form, so you must
either share known test credentials or reset/create accounts for them.

Recommended roles to provide:

```text
admin/demo
doctor/demo
radiologist/demo
technician/demo
patient/demo
```

## OS Rule

Use this team standard:

| OS | Backend/model work | Frontend work |
| --- | --- | --- |
| macOS | Terminal | Terminal |
| Ubuntu/Linux | Bash | Bash |
| Windows | WSL2 Ubuntu | Windows native or WSL2 |

Windows teammates should keep the repo inside WSL, for example:

```text
~/projects/AI4Neuro
```

Avoid backend/model work from:

```text
C:\...
/mnt/c/...
```

## First-Time Setup Commands

### macOS

```bash
brew install python@3.12 node@20 awscli libomp
```

If using `nvm`, install Node 20:

```bash
nvm install 20
nvm use 20
```

### Ubuntu / WSL2 Ubuntu

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip build-essential libomp-dev git awscli
```

Install Node 20 using `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

## Clone

```bash
git clone <repo-url>
cd AI4Neuro
```

## Backend Setup

```bash
cd platform/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements/dev.txt
pip install -r requirements/eeg.txt
pip install -r requirements/mri.txt
```

Create backend env:

```bash
cp .env.example .env
```

Fill:

```env
APP_ENV=development
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:3000

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_or_service_role_key>
SUPABASE_JWT_SECRET=

RAW_FILES_BUCKET=raw-files
REPORT_ASSETS_BUCKET=report-assets
REPORTS_BUCKET=reports
VIEWER_SLICES_BUCKET=viewer-slices

JOB_BACKEND=local
LOCAL_JOB_MAX_WORKERS=1
LOCAL_TMP_DIR=/tmp/neuro-platform
MAX_UPLOAD_MB=512

AUTH_DEV_BYPASS=false
USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=false

EEG_CHECKPOINT_ROOT=/absolute/path/to/AI4Neuro/platform/backend/models/eeg/checkpoints
EEG_REFERENCE_DIR=/absolute/path/to/AI4Neuro/platform/backend/models/eeg/reference
EEG_SIDDHI_DIR=/absolute/path/to/AI4Neuro/platform/backend/app/pipelines/eeg/siddhi
EEG_USE_GPU=false
EEG_DEFAULT_FS=128
EEG_SUBPROCESS_TIMEOUT=600

CONVIT_CHECKPOINT_PATH=/absolute/path/to/AI4Neuro/platform/backend/models/mri/ConVit_checkpoint.pth
MRI_USE_GPU=false
MRI_MODEL_VERSION=ConViT-v1.0
```

For a quick UI/backend-only smoke test without real models, temporarily use:

```env
USE_MOCK_MODEL=true
AUTH_DEV_BYPASS=true
```

For normal team testing with Supabase auth and real checkpoints, use:

```env
USE_MOCK_MODEL=false
AUTH_DEV_BYPASS=false
```

## Sync Model Checkpoints From R2

From repo root:

```bash
cd platform
cp model-sync.env.example model-sync.env
```

Fill `model-sync.env` with the private R2 values. Then run:

```bash
./scripts/sync_models_from_object_storage.sh
```

Expected files after sync:

```text
platform/backend/models/eeg/checkpoints/classification/ADSZ-Indep/.../checkpoint.pth
platform/backend/models/eeg/checkpoints/classification/ADFD-Indep/.../checkpoint.pth
platform/backend/models/mri/ConVit_checkpoint.pth
```

After sync, update the backend `.env` absolute paths if needed.

## Start Backend

```bash
cd platform/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend should be available at:

```text
http://localhost:8000
```

## Frontend Setup

In another terminal:

```bash
cd platform/frontend
nvm use 20
npm ci
cp .env.example .env.local
```

Fill:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sb_publishable_or_anon_key>
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000

SUPABASE_SERVICE_ROLE_KEY=<sb_secret_or_service_role_key>

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASSWORD=
```

Email values are optional for teammates unless they need the admin create-user
email flow.

Start frontend:

```bash
npm run dev
```

Frontend should be available at:

```text
http://localhost:3000
```

## Basic Verification

Backend deterministic tests:

```bash
cd platform/backend
source .venv/bin/activate
AUTH_DEV_BYPASS=true USE_MOCK_MODEL=true python -m pytest \
  tests/test_analysis_flow.py \
  tests/test_permissions.py \
  tests/test_error_messages.py \
  tests/test_mri_pipeline.py
```

Frontend type check:

```bash
cd platform/frontend
npx tsc --noEmit
```

Manual product check:

```text
1. Log in with a test account.
2. Open dashboard.
3. Confirm MRI and EEG flows are visible.
4. Upload a known-good EEG `.npy`.
5. Upload a valid MRI `.nii` or `.nii.gz`.
6. Confirm status, result, report, and PDF generation.
```

## Common Problems

Node version error:

```bash
nvm install 20
nvm use 20
```

Port 8000 already in use:

```bash
lsof -ti :8000 | xargs kill -9
```

R2 credentials not found:

```text
Check platform/model-sync.env exists and contains AWS_ACCESS_KEY_ID,
AWS_SECRET_ACCESS_KEY, MODEL_BUCKET, MODEL_ENDPOINT_URL.
```

Supabase login works but backend returns 401/403:

```text
Check backend .env has SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
AUTH_DEV_BYPASS=false. Restart uvicorn after changing .env.
```

Real model files missing:

```bash
cd platform
./scripts/sync_models_from_object_storage.sh
```

CAT12:

```text
Keep USE_CAT12_PREPROCESSING=false for teammate local setup.
CAT12 is a separate VM/dedicated-machine task.
```
