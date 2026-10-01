# CAT12 Setup, Deployment, And Testing

CAT12 is external neuroimaging tooling, not a Python package. The AI4NEURO
backend can call it, but each host must install and configure CAT12 plus MATLAB
Runtime before `USE_CAT12_PREPROCESSING=true` is enabled.

Official references:

- CAT12 project page: https://neuro-jena.github.io/cat/
- CAT12 source/downloads: https://github.com/ChristianGaser/cat12

## What CAT12 Does In Our MRI Pipeline

Without CAT12:

```text
T1 NIfTI -> slice extraction -> ConViT checkpoint -> Binary/Multiclass result -> PDF
```

With CAT12:

```text
T1 NIfTI -> CAT12 segmentation -> mwp1 grey-matter NIfTI -> slice extraction
-> ConViT checkpoint -> Binary/Multiclass result -> PDF
```

CAT12 is used only for MRI. EEG does not use CAT12.

## Recommended Strategy

Use this order:

1. Keep local teammate setup simple with `USE_CAT12_PREPROCESSING=false`.
2. Validate real MRI ConViT inference locally without CAT12.
3. Provision one staging Linux VM for CAT12.
4. Install CAT12 Standalone and MATLAB Runtime on that VM.
5. Run the CAT12 smoke test on one known-good T1 `.nii` or `.nii.gz`.
6. Only then set `USE_CAT12_PREPROCESSING=true` in staging/prod.

This avoids every teammate needing a heavy CAT12/MATLAB Runtime setup.

## Team Handoff

Assign CAT12 to one teammate as a separate infrastructure task. That teammate
does not need to touch EEG or frontend code.

Owner responsibilities:

1. Pick the target host (macOS, Linux, or Windows).
2. Install CAT12 Standalone for the correct OS/architecture.
3. Install MATLAB Runtime R2023b/v232.
4. Set `CAT12_ROOT`, `CAT12_EXE`, `MCR_ROOT`, and `CAT12_OUTPUT_DIR`.
5. Run `python ../scripts/check_cat12_setup.py`.
6. Run `python ../scripts/check_cat12_setup.py --run --input <known-good-T1.nii.gz>`.
7. Share the final env values and the generated `mwp1...` output path.

Acceptance criteria:

- `check_cat12_setup.py` says config is ready.
- Real CAT12 smoke test produces an `mwp1...` file.
- Backend MRI upload with `USE_CAT12_PREPROCESSING=true` completes.
- MRI PDF/report metadata indicates CAT12 was used.
- Failure logs stay in backend terminal/logs, not exposed as raw errors in UI.

Non-goals for the CAT12 owner:

- They do not need to manage checkpoints (they live in `platform/backend/models/`).
- They do not need to change Supabase schema.
- They do not need to modify frontend flow unless a CAT12-specific status label
  is later requested.

## Local Env

Default teammate mode:

```env
USE_CAT12_PREPROCESSING=false
# CONVIT_CHECKPOINT_PATH defaults to platform/backend/models/mri/ConVit_checkpoint.pth
```

CAT12-enabled mode (macOS example):

```env
USE_CAT12_PREPROCESSING=true
CAT12_ROOT=/Users/<you>/CAT12/CAT12.9_R2023b_MCR_Mac
CAT12_EXE=/Users/<you>/CAT12/CAT12.9_R2023b_MCR_Mac/run_spm25.sh
MCR_ROOT=/Applications/MATLAB/MATLAB_Runtime/v232
CAT12_OUTPUT_DIR=/tmp/neuro-platform/cat12
LOCAL_JOB_MAX_WORKERS=1
```

On first run macOS Gatekeeper may block the binaries; clear it with
`xattr -dr com.apple.quarantine /Users/<you>/CAT12`.

Windows native example:

```env
CAT12_ROOT=C:\CAT12\CAT12.9_R2023b_MCR_Win
CAT12_EXE=C:\CAT12\CAT12.9_R2023b_MCR_Win\spm25.exe
MCR_ROOT=C:\Program Files\MATLAB\MATLAB Runtime\R2023b
CAT12_OUTPUT_DIR=C:\tmp\neuro-platform\cat12
```

For Windows teammates, prefer WSL2 for normal backend/frontend development.
Use native Windows only if specifically testing the Windows CAT12 standalone.

Use `LOCAL_JOB_MAX_WORKERS=1` while CAT12 is enabled. CAT12 can be CPU/RAM
heavy and may take several minutes per scan.

## Install Notes

Use the CAT12 official download links for the matching OS and architecture.
CAT12 Standalone does not need a MATLAB license, but it does need the free
MATLAB Runtime R2023b/v232.

Plan for at least 16 GB RAM for comfortable MRI preprocessing. Do not put large
`.pth` checkpoint files in GitHub.

## Validate Setup

From the repo:

```bash
cd platform/backend
source .venv/bin/activate
python ../scripts/check_cat12_setup.py
```

Expected when paths are missing:

```text
Not ready:
  - CAT12_ROOT is not set.
  - CAT12_EXE is not set.
  - MCR_ROOT is not set.
```

Expected when paths exist:

```text
Config looks ready.
Detected MATLAB Runtime paths: ...
Dry run complete.
```

## Real CAT12 Smoke Test

Use a valid T1 structural MRI NIfTI:

```bash
cd platform/backend
source .venv/bin/activate
python ../scripts/check_cat12_setup.py --run --input /path/to/T1.nii.gz
```

Success means the script prints an `mwp1...` output path. That file is the
CAT12 grey-matter output used by the MRI pipeline.

Then start the API:

```bash
cd platform/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Upload the same `.nii`/`.nii.gz` through the MRI Binary and MRI Multiclass UI.
The report metadata should show CAT12 was used.

## Failure Policy

If `USE_CAT12_PREPROCESSING=true` and CAT12 cannot produce `mwp1...`, the MRI
job should fail with a user-friendly preprocessing error. Raw CAT12 stdout/stderr
belongs in backend logs only, not in the frontend.

For local demo/testing, set:

```env
USE_CAT12_PREPROCESSING=false
```

That keeps MRI ConViT testing unblocked while CAT12 deployment is being hardened.
