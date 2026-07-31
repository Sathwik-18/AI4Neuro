# AI4Neuro End-to-End Deployment and Operations Runbook

This is the primary handoff document for the AI4Neuro staging deployment. It
records what was actually configured on 25 July 2026, explains why each part
exists, and gives a reproducible procedure for rebuilding, updating, or
troubleshooting the platform.

Use this document first. The focused documents linked at the end contain more
detail, but some older planning examples use generic paths. The **Current
staging inventory** and **Oracle path inventory** in this document are the
authoritative record of the working VM.

> This is a technical staging deployment, not approval to process real hospital
> or patient data. Before hospital use, move every account and resource to
> organization ownership and complete the production checklist in this guide.

## Navigation

1. [Read this before copying commands](#1-read-this-before-copying-commands)
2. [What was built](#2-what-was-built)
3. [Current staging inventory](#3-current-staging-inventory)
4. [Public and secret Supabase keys](#4-public-and-secret-supabase-keys)
5. [Accounts and prerequisites](#5-accounts-and-prerequisites)
6. [Workstation preparation](#6-workstation-preparation)
7. [One-time OCI provisioning](#7-one-time-oci-provisioning)
8. [Bootstrap a new Ubuntu VM](#8-bootstrap-a-new-ubuntu-vm)
9. [Configure R2 and download models](#9-configure-cloudflare-r2-and-download-models)
10. [Install CAT12 and MATLAB Runtime](#10-install-cat12-and-matlab-runtime)
11. [Create the protected backend environment](#11-create-the-protected-backend-environment)
12. [Create the FastAPI systemd service](#12-create-the-fastapi-systemd-service)
13. [Install and configure Caddy HTTPS](#13-install-and-configure-caddy-https)
14. [Configure Supabase](#14-configure-supabase)
15. [Deploy the frontend on Vercel](#15-deploy-the-frontend-on-vercel)
16. [Connect Vercel to Oracle](#16-connect-vercel-to-oracle)
17. [Verification performed on staging](#17-verification-performed-on-staging)
18. [Normal backend deployment after main changes](#18-normal-backend-deployment-after-main-changes)
19. [Local development on macOS, Ubuntu, and Windows](#19-local-development-on-macos-ubuntu-and-windows)
20. [Day-to-day operations](#20-day-to-day-operations)
21. [Troubleshooting by symptom](#21-troubleshooting-by-symptom)
22. [Changing devices, networks, IPs, domains, or accounts](#22-changing-devices-networks-ips-domains-or-accounts)
23. [What must change before hospital production](#23-what-must-change-before-hospital-production)
24. [Quick handoff context for a person or LLM](#24-quick-handoff-context-for-a-person-or-llm)
25. [Related documents](#25-related-documents)

---

## 1. Read This Before Copying Commands

### 1.1 Know which computer the command belongs to

The terminal prompt is not part of the command.

| Prompt shown in examples | Where the command runs |
|---|---|
| `macbook %` | A local macOS Terminal |
| `linux-workstation $` | A local Ubuntu/Linux terminal |
| `PS C:\>` | Windows PowerShell |
| `ubuntu@ai4neuro-backend-vnic:~$` | The remote Oracle Ubuntu VM after SSH |
| `ai4neuro` service user | A non-login Linux account used by systemd, not an SSH account |

For example, if this guide shows:

```text
ubuntu@ai4neuro-backend-vnic:~$ sudo systemctl status caddy
```

type only:

```bash
sudo systemctl status caddy
```

Do not type `ubuntu@ai4neuro-backend-vnic:~$`.

### 1.2 Windows strategy

Use:

- Windows PowerShell for SSH, Git, and frontend-only development;
- WSL2 Ubuntu for Python, model sync, EEG/MRI execution, and Linux deployment
  practice;
- native Windows only when deliberately testing the Windows CAT12 standalone.

The production backend is Linux x86-64. WSL2 keeps paths and commands close to
production and avoids maintaining a second native-Windows Python deployment.

### 1.3 Never paste these into a document, chat, screenshot, or Git

- SSH private keys;
- `sb_secret_...` Supabase keys;
- legacy Supabase `service_role` JWTs;
- `SUPABASE_JWT_SECRET`;
- Cloudflare R2 access-key IDs or secret access keys;
- SMTP passwords;
- Oracle recovery codes;
- patient files, reports, or identifying logs.

Public SSH keys ending in `.pub`, a Supabase `sb_publishable_...` key, public
hostnames, and public IP addresses are not passwords. They should still be
handled deliberately.

---

## 2. What Was Built

The working staging request path is:

```text
Browser
  |
  | HTTPS
  v
Vercel: Next.js frontend
  |
  | HTTPS + Supabase user JWT
  v
OCI public IP / sslip.io hostname
  |
  | TCP 443
  v
Caddy reverse proxy
  |
  | private HTTP on the same VM
  v
FastAPI/Uvicorn at 127.0.0.1:8000
  |
  +--> Supabase Auth + Postgres + private Storage buckets
  |
  +--> local EEG checkpoints synced from Cloudflare R2
  |
  +--> local MRI ConViT checkpoint synced from Cloudflare R2
  |
  +--> CAT12 standalone + MATLAB Runtime R2023b
```

Why it is arranged this way:

- Vercel builds and serves the frontend.
- The browser uses only browser-safe Supabase values.
- Caddy provides HTTPS and keeps port 8000 private.
- FastAPI performs privileged operations with a backend-only Supabase key.
- R2 is the source of large model artifacts; model weights stay out of Git.
- CAT12 and MATLAB Runtime run on the x86-64 Ubuntu VM because they are too
  large and stateful for a normal Vercel function.
- One local worker limits memory and CPU pressure while CAT12 is enabled.

---

## 3. Current Staging Inventory

This section records the deployment that was verified on 25 July 2026.

| Component | Current staging value |
|---|---|
| GitHub repository | `https://github.com/Asifussain/AI4Neuro.git` |
| Production branch | `main` |
| Deployed merge commit | `43848131b115391b9c526357b2685287faf447d5` |
| OCI region | India South, Hyderabad (`ap-hyderabad-1`) |
| OCI VM OS | Canonical Ubuntu 22.04 LTS, x86-64 |
| OCI VM shape | `VM.Standard.E5.Flex` |
| VM resources | 1 OCPU, 16 GB RAM, 150 GB boot volume |
| VM public IP | `140.245.218.129` |
| Temporary API hostname | `140-245-218-129.sslip.io` |
| Temporary API URL | `https://140-245-218-129.sslip.io` |
| SSH username | `ubuntu` |
| Local SSH key filename | `ai4neuro_oracle` |
| Backend service user | `ai4neuro` |
| Backend private listener | `127.0.0.1:8000` |
| Public listeners | Caddy on ports 80 and 443 |
| Vercel project | `ai4neuro` |
| Vercel production URL | `https://ai4neuro.vercel.app` |
| Vercel root directory | `platform/frontend` |
| Vercel preset | Next.js |
| Supabase buckets | `raw-files`, `report-assets`, `reports`, `viewer-slices` |
| R2 bucket | `ai4neuro-models` |
| R2 prefix | `ai4neuro/` |
| R2 endpoint | `https://f3c30aedba5fd75851f5f721d11b77a6.r2.cloudflarestorage.com` |

The IP address, `sslip.io` hostname, Vercel personal project, Supabase project,
R2 account, and OCI tenancy are staging records. Replace personal ownership
before hospital production.

### 3.1 Oracle path inventory

```text
/opt/ai4neuro/
  app/                         Git checkout
  venv/                        Python virtual environment
  models/
    eeg/checkpoints/           Three downloaded EEG checkpoint trees
    mri/ConVit_checkpoint.pth  MRI checkpoint
  installers/                  Downloaded CAT12 and MATLAB Runtime ZIPs
  backups/                     Deployment backups
  .aws/                        R2 AWS CLI profile
  .mcrCache/                   MATLAB Runtime cache

/opt/cat12/CAT12.9_R2023b_MCR_Linux/
  run_spm25.sh                 Launcher used by the backend
  spm25                        Compiled SPM executable
  standalone/                  CAT12 standalone scripts

/opt/MATLAB/MATLAB_Runtime/R2023b/R2023b/
  runtime/glnxa64/
  bin/glnxa64/
  sys/os/glnxa64/
  extern/bin/glnxa64/
  sys/opengl/lib/glnxa64/

/etc/ai4neuro/backend.env      Protected backend environment
/etc/systemd/system/ai4neuro-backend.service
/etc/caddy/Caddyfile
/etc/iptables/rules.v4

/tmp/neuro-platform/           Temporary jobs
/tmp/neuro-platform/cat12/     CAT12 job output root
```

The duplicated `R2023b/R2023b` in the MATLAB Runtime path is real. It resulted
from selecting `/opt/MATLAB/MATLAB_Runtime/R2023b` as the installer destination
and the installer creating its own release directory below it.

### 3.2 Model artifact inventory

R2:

```text
s3://ai4neuro-models/ai4neuro/
  eeg/checkpoints/classification/
    APAVA-Indep/.../checkpoint.pth
    ADSZ-Indep/.../checkpoint.pth
    ADFD-Indep/.../checkpoint.pth
  mri/ConVit_checkpoint.pth
```

Oracle:

```text
/opt/ai4neuro/models/eeg/checkpoints/   approximately 59 MB, 3 checkpoint.pth files
/opt/ai4neuro/models/mri/ConVit_checkpoint.pth
                                       1,029,511,339 bytes
```

The EEG reference arrays currently used by the application are in:

```text
/opt/ai4neuro/app/platform/backend/representative/
  ad repr.npy
  cn repr.npy
  mci repr.npy
```

Therefore the current Oracle `EEG_REFERENCE_DIR` is the backend directory, not
`/opt/ai4neuro/models/eeg/reference`.

`USE_MOCK_MODEL=false` remains in the staging environment for compatibility
with the earlier configuration, but the current typed backend settings do not
read that variable. In the current unified pipeline, the ConViT checkpoint is
required and an unavailable real model fails explicitly. Do not depend on
`USE_MOCK_MODEL` as a production safety switch without first verifying the
current source revision.

---

## 4. Public and Secret Supabase Keys

The variable names include legacy wording, so use this mapping:

| Application variable | Value type | Where it may exist |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser/Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | New `sb_publishable_...` key, despite the old variable name | Browser/Vercel |
| `SUPABASE_URL` | Same Supabase project URL | Oracle backend |
| `SUPABASE_SERVICE_ROLE_KEY` | New `sb_secret_...` key, despite the old variable name | Server only |
| `SUPABASE_JWT_SECRET` | Legacy HS256 JWT-verification secret, if needed | Server only |

Rules:

- A variable beginning with `NEXT_PUBLIC_` is embedded into browser JavaScript.
- Never place `sb_secret_...` in a `NEXT_PUBLIC_*` variable.
- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` are different values.
- New asymmetric Supabase signing keys can be verified through JWKS, so
  `SUPABASE_JWT_SECRET` may be unnecessary for a newer project.

During initial Vercel setup, a secret key was accidentally placed in
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Supabase correctly returned:

```text
Forbidden use of secret API key in browser
```

That exposed key was deleted. The Vercel variable was replaced with the
`sb_publishable_...` value and the frontend was redeployed.

If this happens again:

1. delete/revoke the exposed secret immediately;
2. create a new server secret;
3. update only the protected Oracle environment;
4. put the publishable key in Vercel;
5. redeploy Vercel because `NEXT_PUBLIC_*` values are build-time values;
6. restart FastAPI after changing its server environment.

---

## 5. Accounts and Prerequisites

Before rebuilding, have:

- organization-controlled GitHub access;
- an OCI tenancy or AWS account with MFA and billing alerts;
- an organization-controlled domain for production;
- a Supabase project;
- a Cloudflare account with the R2 bucket;
- a Vercel team/project;
- at least two infrastructure administrators;
- a password manager or secrets manager;
- an approved anonymized EEG sample and T1 NIfTI for smoke tests.

For the current staging VM, the minimum practical target is:

```text
Ubuntu 22.04 LTS
x86-64 CPU
16 GB RAM
150 GB disk
1 worker
```

Do not use OCI's Arm A1 shape for this CAT12 Linux package. The installed
standalone and MATLAB Runtime are `glnxa64`, meaning Linux x86-64.

---

## 6. Workstation Preparation

The workstation is used only to administer the VM and develop the code. The
backend keeps running when that laptop is disconnected.

### 6.1 Find the workstation network's public IPv4

macOS or Linux:

```bash
curl -4 https://ifconfig.me
echo
```

Windows PowerShell:

```powershell
(Invoke-RestMethod -Uri "https://ifconfig.me/ip").Trim()
```

If the result is `203.0.113.25`, the OCI SSH ingress source is:

```text
203.0.113.25/32
```

This address identifies the current internet connection, not the laptop.
Home/office Wi-Fi, VPNs, hotspots, and ISP address changes can alter it. Update
the OCI port-22 rule whenever the administrative network changes.

### 6.2 Generate an individual SSH key

macOS:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -a 100 \
  -C "your-name-ai4neuro" \
  -f ~/.ssh/ai4neuro_oracle
chmod 600 ~/.ssh/ai4neuro_oracle
chmod 644 ~/.ssh/ai4neuro_oracle.pub
pbcopy < ~/.ssh/ai4neuro_oracle.pub
```

Ubuntu/Linux:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -a 100 \
  -C "your-name-ai4neuro" \
  -f ~/.ssh/ai4neuro_oracle
chmod 600 ~/.ssh/ai4neuro_oracle
chmod 644 ~/.ssh/ai4neuro_oracle.pub
cat ~/.ssh/ai4neuro_oracle.pub
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME\.ssh" | Out-Null
ssh-keygen -t ed25519 `
  -C "your-name-ai4neuro" `
  -f "$HOME\.ssh\ai4neuro_oracle"
Get-Content "$HOME\.ssh\ai4neuro_oracle.pub" | Set-Clipboard
```

Only paste the `.pub` content into OCI or the server. Never share the file
without `.pub`.

### 6.3 Connect

macOS/Linux:

```bash
ssh -i ~/.ssh/ai4neuro_oracle ubuntu@140.245.218.129
```

Windows PowerShell:

```powershell
ssh -i "$HOME\.ssh\ai4neuro_oracle" ubuntu@140.245.218.129
```

If the IP has changed, replace it with the current reserved/public IP. If the
connection times out, check the OCI port-22 `/32` ingress rule before changing
the server.

---

## 7. One-Time OCI Provisioning

The console labels can change slightly, but the choices are:

### 7.1 Network

Create:

```text
Compartment: ai4neuro-production
VCN:         ai4neuro-vcn
VCN CIDR:    10.0.0.0/16
Subnet:      ai4neuro-public-subnet
Subnet CIDR: 10.0.0.0/24
IPv6:        disabled initially
```

Enable DNS hostnames. The subnet must have an internet gateway and a route:

```text
0.0.0.0/0 -> Internet Gateway
```

### 7.2 Security-list ingress

Create stateful rules:

| Source | Protocol | Destination port |
|---|---|---:|
| `ADMIN_PUBLIC_IP/32` | TCP | 22 |
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

Do not create a public port-8000 rule.

### 7.3 Compute instance

```text
Image:       Canonical Ubuntu 22.04
Architecture:x86-64
Shape:       VM.Standard.E5.Flex
OCPU:        1 initially
Memory:      16 GB
Boot volume: 150 GB, 10 VPU
Public IPv4: enabled
SSH key:     paste one administrator's .pub key
```

The E5 shape is a paid/trial-credit resource. The OCI estimate shown during
creation is the list-price estimate; free-trial credits can cover it until
they expire. A Free Tier account without a payment method does not silently
become a paid account, but non-Always-Free resources stop when trial credits
end. Confirm the current subscription and cost controls in the organization
account rather than assuming the old trial still applies.

For production, use an organization-owned account, reserved public IP, budgets,
and monitoring.

---

## 8. Bootstrap a New Ubuntu VM

Run this section after SSH, on the Oracle VM.

### 8.1 Patch and install packages

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y \
  build-essential \
  ca-certificates \
  curl \
  git \
  gnupg \
  jq \
  net-tools \
  openssh-server \
  python3 \
  python3-dev \
  python3-pip \
  python3-venv \
  tmux \
  unzip \
  vim \
  wget \
  zip
```

If the package manager shows a purple `needrestart` screen:

- accept the default selected services;
- press Tab until `<Ok>` is selected;
- press Enter;
- reboot if a new kernel was installed.

```bash
sudo reboot
```

Wait approximately one minute, then reconnect from the workstation. Verify:

```bash
uname -r
sudo apt update
sudo apt upgrade -y
```

### 8.2 Create the service account and directories

```bash
sudo adduser \
  --system \
  --group \
  --home /opt/ai4neuro \
  --shell /usr/sbin/nologin \
  ai4neuro

sudo install -d -o ai4neuro -g ai4neuro -m 750 \
  /opt/ai4neuro/app \
  /opt/ai4neuro/models \
  /opt/ai4neuro/installers \
  /opt/ai4neuro/backups \
  /tmp/neuro-platform

sudo install -d -o root -g ai4neuro -m 750 \
  /etc/ai4neuro
```

Why:

- `ubuntu` is the human administrative account;
- `ai4neuro` is a least-privilege application account;
- systemd runs the backend as `ai4neuro`, not root;
- the service account intentionally cannot be used for SSH.

Verify:

```bash
id ai4neuro
sudo ls -ld \
  /opt/ai4neuro \
  /opt/ai4neuro/app \
  /etc/ai4neuro \
  /tmp/neuro-platform
```

### 8.3 Clone the public repository

```bash
sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git clone \
  --branch main \
  --single-branch \
  https://github.com/Asifussain/AI4Neuro.git \
  /opt/ai4neuro/app

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app status --short --branch

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app rev-parse HEAD
```

Expected branch:

```text
## main...origin/main
```

If the repository becomes private, do not store a developer's personal token
on the VM. Use an organization-owned read-only deploy key or workload identity.

### 8.4 Repair an old single-branch clone

The first staging clone tracked only `FromMergeML2`, so `origin/main` was not a
normal configured remote branch. This repaired it:

```bash
sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app config --add \
  remote.origin.fetch \
  '+refs/heads/main:refs/remotes/origin/main'

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app fetch origin

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app switch \
  --create main \
  --track origin/main
```

New clones made with `--branch main` do not need this repair.

### 8.5 Create the Python environment

```bash
sudo -u ai4neuro \
  python3 -m venv /opt/ai4neuro/venv

sudo -u ai4neuro \
  /opt/ai4neuro/venv/bin/python -m pip install \
  --upgrade pip setuptools wheel
```

Install the CPU PyTorch build first:

```bash
sudo -u ai4neuro \
  /opt/ai4neuro/venv/bin/pip install \
  torch torchvision \
  --index-url https://download.pytorch.org/whl/cpu
```

Install application and test dependencies:

```bash
sudo -u ai4neuro \
  /opt/ai4neuro/venv/bin/pip install \
  -r /opt/ai4neuro/app/platform/backend/requirements/eeg.txt \
  -r /opt/ai4neuro/app/platform/backend/requirements/mri.txt \
  -r /opt/ai4neuro/app/platform/backend/requirements/dev.txt
```

Verify:

```bash
sudo -u ai4neuro \
  /opt/ai4neuro/venv/bin/python -c \
  'import torch; print(torch.__version__); print("CUDA:", torch.cuda.is_available())'

sudo -u ai4neuro \
  /opt/ai4neuro/venv/bin/python -m pip check
```

The staging VM is CPU-only, so `CUDA: False` is correct.

When running a command as `ai4neuro`, start from `/tmp` or use a shell whose
working directory is accessible. Running `sudo -u ai4neuro` while the shell is
inside `/home/ubuntu` can produce:

```text
Permission denied: /home/ubuntu
find: Failed to restore initial working directory
```

Use:

```bash
cd /tmp
sudo -u ai4neuro /bin/bash -c \
  'cd /opt/ai4neuro/app/platform/backend && /opt/ai4neuro/venv/bin/python -m pytest -q'
```

---

## 9. Configure Cloudflare R2 and Download Models

### 9.1 Create the R2 credential

In Cloudflare, create a dedicated token with read-only object access to the
`ai4neuro-models` bucket. Do not reuse the model uploader's read/write token.

Install AWS CLI on Oracle:

```bash
sudo apt update
sudo apt install -y awscli
aws --version
```

Create the protected profile interactively so values do not appear in shell
history:

```bash
sudo install -d -o ai4neuro -g ai4neuro -m 700 \
  /opt/ai4neuro/.aws

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  aws configure --profile r2
```

Enter:

```text
AWS Access Key ID:     the dedicated R2 read-only access key
AWS Secret Access Key: the dedicated R2 read-only secret
Default region name:   auto
Default output format: json
```

Protect and verify permissions:

```bash
sudo chmod 700 /opt/ai4neuro/.aws
sudo chmod 600 \
  /opt/ai4neuro/.aws/config \
  /opt/ai4neuro/.aws/credentials
sudo chown -R ai4neuro:ai4neuro /opt/ai4neuro/.aws

sudo stat -c '%a %U:%G %n' \
  /opt/ai4neuro/.aws \
  /opt/ai4neuro/.aws/config \
  /opt/ai4neuro/.aws/credentials
```

Do not print the credentials file.

### 9.2 Verify R2 access

```bash
R2_ENDPOINT='https://f3c30aedba5fd75851f5f721d11b77a6.r2.cloudflarestorage.com'

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  aws --profile r2 s3 ls \
  s3://ai4neuro-models/ai4neuro/ \
  --endpoint-url "$R2_ENDPOINT"
```

Expected prefixes:

```text
PRE eeg/
PRE mri/
```

### 9.3 Download the MRI checkpoint

```bash
R2_ENDPOINT='https://f3c30aedba5fd75851f5f721d11b77a6.r2.cloudflarestorage.com'

sudo install -d -o ai4neuro -g ai4neuro -m 750 \
  /opt/ai4neuro/models/mri

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  aws --profile r2 s3 cp \
  s3://ai4neuro-models/ai4neuro/mri/ConVit_checkpoint.pth \
  /opt/ai4neuro/models/mri/ConVit_checkpoint.pth \
  --endpoint-url "$R2_ENDPOINT" \
  --only-show-errors

sudo chmod 640 \
  /opt/ai4neuro/models/mri/ConVit_checkpoint.pth
```

Verify without opening the checkpoint:

```bash
sudo stat -c '%n | %s bytes | %U:%G | mode %a' \
  /opt/ai4neuro/models/mri/ConVit_checkpoint.pth
```

### 9.4 Download EEG checkpoints

```bash
R2_ENDPOINT='https://f3c30aedba5fd75851f5f721d11b77a6.r2.cloudflarestorage.com'

sudo install -d -o ai4neuro -g ai4neuro -m 750 \
  /opt/ai4neuro/models/eeg/checkpoints

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  aws --profile r2 s3 sync \
  s3://ai4neuro-models/ai4neuro/eeg/checkpoints/ \
  /opt/ai4neuro/models/eeg/checkpoints/ \
  --endpoint-url "$R2_ENDPOINT" \
  --only-show-errors

sudo chown -R ai4neuro:ai4neuro \
  /opt/ai4neuro/models/eeg
sudo chmod -R u=rwX,g=rX,o= \
  /opt/ai4neuro/models/eeg
```

Verify:

```bash
cd /tmp
sudo -u ai4neuro find \
  /opt/ai4neuro/models/eeg/checkpoints \
  -type f \
  -name 'checkpoint.pth' \
  -readable \
  -print

sudo du -sh /opt/ai4neuro/models/eeg/checkpoints
```

Expected file count: 3.

### 9.5 Rotate or replace the R2 token

1. create a new read-only token;
2. run `aws configure --profile r2` as the service user;
3. list the bucket to verify it;
4. revoke the old token;
5. test listing again;
6. do not change application source files.

---

## 10. Install CAT12 and MATLAB Runtime

CAT12 is not installed with pip. The server uses the Linux x86-64 standalone
build and the matching MATLAB Runtime R2023b Update 10.

### 10.1 Download CAT12

```bash
cd /tmp

sudo -u ai4neuro curl -fL \
  --retry 5 \
  --retry-all-errors \
  --progress-bar \
  https://www.neuro.uni-jena.de/cat12/CAT12.9_R2023b_MCR_Linux.zip \
  -o /opt/ai4neuro/installers/CAT12.9_R2023b_MCR_Linux.zip

sudo -u ai4neuro unzip -tq \
  /opt/ai4neuro/installers/CAT12.9_R2023b_MCR_Linux.zip
```

Extract:

```bash
sudo install -d -o ai4neuro -g ai4neuro -m 755 \
  /opt/cat12

sudo -u ai4neuro unzip -q \
  /opt/ai4neuro/installers/CAT12.9_R2023b_MCR_Linux.zip \
  -d /opt/cat12
```

Verify:

```bash
sudo -u ai4neuro ls -lh \
  /opt/cat12/CAT12.9_R2023b_MCR_Linux/run_spm25.sh \
  /opt/cat12/CAT12.9_R2023b_MCR_Linux/spm25 \
  /opt/cat12/CAT12.9_R2023b_MCR_Linux/standalone/cat_standalone.sh \
  /opt/cat12/CAT12.9_R2023b_MCR_Linux/MCR_v232.webloc
```

### 10.2 Download MATLAB Runtime

The `MCR_v232.webloc` file in the CAT12 archive identified the matching
installer:

```bash
cd /tmp

sudo -u ai4neuro curl -fL \
  --retry 5 \
  --retry-all-errors \
  --progress-bar \
  'https://ssd.mathworks.com/supportfiles/downloads/R2023b/Release/10/deployment_files/installer/complete/glnxa64/MATLAB_Runtime_R2023b_Update_10_glnxa64.zip' \
  -o /opt/ai4neuro/installers/MATLAB_Runtime_R2023b_Update_10_glnxa64.zip

sudo -u ai4neuro unzip -tq \
  /opt/ai4neuro/installers/MATLAB_Runtime_R2023b_Update_10_glnxa64.zip
```

Extract the installer:

```bash
sudo install -d -o ai4neuro -g ai4neuro -m 750 \
  /opt/ai4neuro/installers/matlab-runtime-r2023b

sudo -u ai4neuro unzip -q \
  /opt/ai4neuro/installers/MATLAB_Runtime_R2023b_Update_10_glnxa64.zip \
  -d /opt/ai4neuro/installers/matlab-runtime-r2023b
```

Run the installer from a persistent `tmux` session because the installation is
large:

```bash
tmux new -s ai4neuro-setup
```

Inside `tmux`:

```bash
cd /opt/ai4neuro/installers/matlab-runtime-r2023b

sudo ./install \
  -mode silent \
  -agreeToLicense yes \
  -destinationFolder /opt/MATLAB/MATLAB_Runtime/R2023b
```

If SSH disconnects, reconnect to Oracle first, then run on Oracle:

```bash
tmux attach -t ai4neuro-setup
```

Do not run `tmux attach` on the Mac or Windows workstation unless `tmux` was
started locally. The session lives on Oracle.

Verify the actual installed paths:

```bash
sudo ls -ld \
  /opt/MATLAB/MATLAB_Runtime/R2023b/R2023b/runtime/glnxa64 \
  /opt/MATLAB/MATLAB_Runtime/R2023b/R2023b/bin/glnxa64 \
  /opt/MATLAB/MATLAB_Runtime/R2023b/R2023b/sys/os/glnxa64 \
  /opt/MATLAB/MATLAB_Runtime/R2023b/R2023b/extern/bin/glnxa64 \
  /opt/MATLAB/MATLAB_Runtime/R2023b/R2023b/sys/opengl/lib/glnxa64
```

The installer prints an `LD_LIBRARY_PATH`. The CAT12 `run_spm25.sh` launcher
constructs the required runtime library path when it receives `MCR_ROOT`, so a
global `/etc/environment` change is not needed for this deployment.

### 10.3 Create and test the MCR cache

```bash
sudo install -d -o ai4neuro -g ai4neuro -m 750 \
  /opt/ai4neuro/.mcrCache

sudo -u ai4neuro env \
  HOME=/opt/ai4neuro \
  MCR_CACHE_ROOT=/opt/ai4neuro/.mcrCache \
  timeout 600 \
  /opt/cat12/CAT12.9_R2023b_MCR_Linux/run_spm25.sh \
  /opt/MATLAB/MATLAB_Runtime/R2023b/R2023b \
  quit
```

Expected output ends with:

```text
Bye for now...
```

### 10.4 Validate backend CAT12 configuration

```bash
sudo install -d -o ai4neuro -g ai4neuro -m 750 \
  /tmp/neuro-platform/cat12

cd /tmp
sudo -u ai4neuro env \
  HOME=/opt/ai4neuro \
  MCR_CACHE_ROOT=/opt/ai4neuro/.mcrCache \
  PYTHONPATH=/opt/ai4neuro/app/platform/backend \
  USE_CAT12_PREPROCESSING=true \
  CAT12_ROOT=/opt/cat12/CAT12.9_R2023b_MCR_Linux \
  CAT12_EXE=/opt/cat12/CAT12.9_R2023b_MCR_Linux/run_spm25.sh \
  MCR_ROOT=/opt/MATLAB/MATLAB_Runtime/R2023b/R2023b \
  CAT12_OUTPUT_DIR=/tmp/neuro-platform/cat12 \
  /opt/ai4neuro/venv/bin/python -c '
import os
from app.pipelines.mri.config import CAT12_ROOT, CAT12_EXE, MCR_ROOT
from app.pipelines.mri.cat12_manager import validate_cat12_config
issues = validate_cat12_config()
print("CAT12_ROOT exists:", os.path.isdir(CAT12_ROOT))
print("CAT12_EXE executable:", os.access(CAT12_EXE, os.X_OK))
print("MCR_ROOT exists:", os.path.isdir(MCR_ROOT))
print("Configuration issues:", issues)
assert not issues
assert os.access(CAT12_EXE, os.X_OK)
print("CAT12 BACKEND CONFIGURATION: READY")
'
```

Use this direct check rather than assuming the repository helper is current.
At the time of deployment, `platform/scripts/check_cat12_setup.py` referenced a
helper/API shape that did not match the current CAT12 manager.

### 10.5 Real CAT12 smoke test and `.nii.gz` workaround

Use only an approved anonymized structural T1 scan.

The current manager writes the uploaded path directly into an SPM batch. During
the staging test, passing a `.nii.gz` directly produced:

```text
Item 'Volumes', field 'val': Number of matching files (0) less than required (1)
```

Operational workaround:

```bash
mkdir -p /tmp/neuro-platform/cat12-smoke
gunzip -c /path/to/approved-input.nii.gz \
  > /tmp/neuro-platform/cat12-smoke/T1_uncompressed.nii
sudo chown -R ai4neuro:ai4neuro \
  /tmp/neuro-platform/cat12-smoke
```

Then call the backend manager:

```bash
cd /tmp
sudo -u ai4neuro env \
  HOME=/opt/ai4neuro \
  MCR_CACHE_ROOT=/opt/ai4neuro/.mcrCache \
  PYTHONPATH=/opt/ai4neuro/app/platform/backend \
  USE_CAT12_PREPROCESSING=true \
  CAT12_ROOT=/opt/cat12/CAT12.9_R2023b_MCR_Linux \
  CAT12_EXE=/opt/cat12/CAT12.9_R2023b_MCR_Linux/run_spm25.sh \
  MCR_ROOT=/opt/MATLAB/MATLAB_Runtime/R2023b/R2023b \
  CAT12_OUTPUT_DIR=/tmp/neuro-platform/cat12-smoke \
  /opt/ai4neuro/venv/bin/python - <<'PY'
import os
from app.pipelines.mri.cat12_manager import run_cat12_preprocessing

source = "/tmp/neuro-platform/cat12-smoke/T1_uncompressed.nii"
result = run_cat12_preprocessing(source)
print("CAT12 result:", result)
assert result is not None
assert os.path.exists(result.mwp1_path)
print("CAT12 BACKEND SEGMENTATION: SUCCESS")
PY
```

The verified run took 11 minutes 14 seconds and produced `mwp1`, `mwp2`, `p0`,
report XML, ROI XML, and a PDF. Keep `CAT12_TIMEOUT_SECONDS=3600` and
`LOCAL_JOB_MAX_WORKERS=1`.

---

## 11. Create the Protected Backend Environment

The working environment file is:

```text
/etc/ai4neuro/backend.env
```

It must be:

```text
mode 640
owner root
group ai4neuro
```

Open it interactively:

```bash
sudo nano /etc/ai4neuro/backend.env
```

Use this template and replace only placeholders:

```env
APP_ENV=production
API_HOST=127.0.0.1
API_PORT=8000
CORS_ORIGINS=http://localhost:3000,https://ai4neuro.vercel.app

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SB_SECRET
SUPABASE_JWT_SECRET=YOUR_LEGACY_JWT_SECRET_IF_REQUIRED

RAW_FILES_BUCKET=raw-files
REPORT_ASSETS_BUCKET=report-assets
REPORTS_BUCKET=reports
VIEWER_SLICES_BUCKET=viewer-slices

JOB_BACKEND=local
LOCAL_JOB_MAX_WORKERS=1
LOCAL_TMP_DIR=/tmp/neuro-platform
MAX_UPLOAD_MB=512
SUPABASE_HTTP_TIMEOUT_SECONDS=600

AUTH_DEV_BYPASS=false
USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=true

EEG_CHECKPOINT_ROOT=/opt/ai4neuro/models/eeg/checkpoints
EEG_REFERENCE_DIR=/opt/ai4neuro/app/platform/backend
EEG_SIDDHI_DIR=/opt/ai4neuro/app/platform/backend/app/pipelines/eeg/siddhi
EEG_USE_GPU=false
EEG_DEFAULT_FS=128
EEG_SUBPROCESS_TIMEOUT=600
EEG_APPLY_ZSCORE=false

CONVIT_CHECKPOINT_PATH=/opt/ai4neuro/models/mri/ConVit_checkpoint.pth
CAT12_ROOT=/opt/cat12/CAT12.9_R2023b_MCR_Linux
CAT12_EXE=/opt/cat12/CAT12.9_R2023b_MCR_Linux/run_spm25.sh
MCR_ROOT=/opt/MATLAB/MATLAB_Runtime/R2023b/R2023b
CAT12_OUTPUT_DIR=/tmp/neuro-platform/cat12
CAT12_TIMEOUT_SECONDS=3600
MRI_USE_GPU=false
MRI_MODEL_VERSION=ConViT-v1.0

HOME=/opt/ai4neuro
MCR_CACHE_ROOT=/opt/ai4neuro/.mcrCache
```

If the new Supabase project uses asymmetric JWT signing, leave
`SUPABASE_JWT_SECRET` empty only after verifying authenticated requests through
the backend.

Protect it:

```bash
sudo chown root:ai4neuro /etc/ai4neuro/backend.env
sudo chmod 640 /etc/ai4neuro/backend.env
sudo stat -c '%a %U:%G %n' /etc/ai4neuro/backend.env
```

Expected:

```text
640 root:ai4neuro /etc/ai4neuro/backend.env
```

To verify presence without printing values:

```bash
sudo awk -F= '
  $1=="SUPABASE_URL" {
    print "SUPABASE_URL:", length($2) ? "SET" : "EMPTY"
  }
  $1=="SUPABASE_SERVICE_ROLE_KEY" {
    print "SUPABASE_SERVICE_ROLE_KEY:",
      $2 ~ /^sb_secret_/ ? "NEW SECRET SET" : "VALUE NEEDS CHECKING"
  }
' /etc/ai4neuro/backend.env
```

### 11.1 When CORS must change

`CORS_ORIGINS` is a comma-separated list of exact browser origins:

```text
scheme + hostname + optional port
```

Correct:

```text
https://ai4neuro.vercel.app
```

Incorrect:

```text
https://ai4neuro.vercel.app/radiologist/dashboard
https://140-245-218-129.sslip.io
*
```

The frontend origin belongs in CORS, not the backend hostname. Add a new origin
when:

- the production Vercel/custom domain changes;
- a controlled preview domain must call the production backend;
- a new local frontend port is introduced.

Do not use wildcard CORS for authenticated hospital data.

Back up before editing:

```bash
sudo cp -a \
  /etc/ai4neuro/backend.env \
  "/etc/ai4neuro/backend.env.backup-$(date +%Y%m%d-%H%M%S)"
```

Restart the backend after any environment change.

---

## 12. Create the FastAPI systemd Service

Create:

```bash
sudo nano /etc/systemd/system/ai4neuro-backend.service
```

Contents:

```ini
[Unit]
Description=AI4Neuro FastAPI Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ai4neuro
Group=ai4neuro
WorkingDirectory=/opt/ai4neuro/app/platform/backend
EnvironmentFile=/etc/ai4neuro/backend.env
ExecStart=/opt/ai4neuro/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
PrivateTmp=false

[Install]
WantedBy=multi-user.target
```

`PrivateTmp=false` is intentional because the configured jobs use
`/tmp/neuro-platform`. A future hardened unit may instead move temporary jobs
under `/opt/ai4neuro` and enable systemd private temporary storage.

Load and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ai4neuro-backend.service
sudo systemctl --no-pager --full status ai4neuro-backend.service
```

The systemd state can become `active` slightly before Uvicorn has bound port
8000. After restart, poll instead of testing at the same millisecond:

```bash
for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8000/api/v1/health; then
    echo
    break
  fi
  sleep 1
done
```

Inspect failures:

```bash
sudo journalctl \
  -u ai4neuro-backend.service \
  -n 150 \
  --no-pager
```

---

## 13. Install and Configure Caddy HTTPS

Caddy accepts public HTTP/HTTPS and reverse-proxies only to the private
FastAPI listener.

### 13.1 Install Caddy

```bash
sudo apt install -y \
  debian-keyring \
  debian-archive-keyring \
  apt-transport-https \
  curl

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor \
      -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list

sudo chmod o+r \
  /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
  /etc/apt/sources.list.d/caddy-stable.list

sudo apt update
sudo apt install -y caddy
```

### 13.2 Configure the temporary hostname

Confirm DNS:

```bash
getent ahostsv4 140-245-218-129.sslip.io
```

Back up and edit:

```bash
sudo cp -a \
  /etc/caddy/Caddyfile \
  /etc/caddy/Caddyfile.before-ai4neuro

sudo nano /etc/caddy/Caddyfile
```

Contents:

```caddy
140-245-218-129.sslip.io {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8000
}
```

Format, validate, and reload:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl enable caddy
```

### 13.3 Fix the OCI Ubuntu host firewall

OCI ingress and the Ubuntu host firewall are separate layers. On the staging
image, UFW was inactive but raw `iptables` allowed only SSH before a final
`REJECT`.

Inspect:

```bash
sudo ss -lntp | grep -E ':(22|80|443|8000)\b'
sudo ufw status verbose
sudo iptables -L INPUT -n -v --line-numbers
```

Before editing, back up:

```bash
sudo iptables-save \
  | sudo tee /root/iptables-before-ai4neuro-web.rules >/dev/null
```

Insert port 80 and 443 rules immediately before the final `REJECT`. The staging
chain had the rejection at rule 5:

```bash
sudo iptables \
  -I INPUT 5 \
  -p tcp \
  -m state --state NEW \
  --dport 80 \
  -j ACCEPT

sudo iptables \
  -I INPUT 6 \
  -p tcp \
  -m state --state NEW \
  --dport 443 \
  -j ACCEPT
```

Always inspect current line numbers first. Do not blindly reuse `5` and `6` on
a different image.

Persist after verifying external HTTPS:

```bash
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
sudo systemctl enable netfilter-persistent.service
sudo grep -nE -- '--dport (22|80|443)' /etc/iptables/rules.v4
```

Expected order:

```text
ACCEPT 22
ACCEPT 80
ACCEPT 443
REJECT everything else
```

### 13.4 Verify HTTPS

On Oracle:

```bash
curl -I \
  http://140-245-218-129.sslip.io/api/v1/health

curl -fsS \
  https://140-245-218-129.sslip.io/api/v1/health
echo
```

The HTTP request should redirect to HTTPS. The HTTPS response should contain
`"status":"ok"`.

From macOS/Linux:

```bash
curl -fsS \
  https://140-245-218-129.sslip.io/api/v1/health
echo
```

From Windows PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "https://140-245-218-129.sslip.io/api/v1/health"
```

---

## 14. Configure Supabase

Use [`SETUP_GUIDE.md`](./SETUP_GUIDE.md) for schema creation and role seeding.
At minimum:

1. apply the Supabase migrations;
2. confirm RLS is enabled and reviewed;
3. confirm these private buckets exist:
   - `raw-files`
   - `report-assets`
   - `reports`
   - `viewer-slices`
4. create a dedicated backend `sb_secret_...` key;
5. obtain the browser-safe `sb_publishable_...` key;
6. configure approved redirect URLs for the Vercel/custom frontend;
7. never use real patient data in personal/free staging accounts.

Verify from Oracle without printing secrets:

```bash
curl -fsS http://127.0.0.1:8000/api/v1/health/database
echo
curl -fsS http://127.0.0.1:8000/api/v1/health/storage
echo
```

Expected:

```json
{"status":"ok","configured":true}
```

The storage response must list all four buckets.

---

## 15. Deploy the Frontend on Vercel

### 15.1 Project settings

Import:

```text
Repository:     Asifussain/AI4Neuro
Branch:         main
Project name:   ai4neuro
Framework:      Next.js
Root directory: platform/frontend
```

Leave normal Next.js build/install/output values auto-detected unless a build
log proves an override is needed.

The initial deployment used the `Other` preset. Vercel reported the deployment
as Ready but served its generic `404 NOT_FOUND`. Changing the preset to Next.js
and redeploying fixed routing.

If production settings change after a deployment, create a new deployment.
Changing project settings does not rewrite the already-built artifact.

### 15.2 Vercel browser environment

Set for Production and the intended Preview environments:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SB_PUBLISHABLE_KEY
NEXT_PUBLIC_API_BASE_URL=https://140-245-218-129.sslip.io
```

Do not add these as public values:

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
EMAIL_PASSWORD
```

The frontend contains server route handlers that may eventually need a
server-only `SUPABASE_SERVICE_ROLE_KEY` and SMTP variables. Add those only to
an organization-owned Vercel project after reviewing the routes and access
policy. They must never have the `NEXT_PUBLIC_` prefix.

Redeploy after changing `NEXT_PUBLIC_*`.

### 15.3 Production and preview branch behavior

Recommended:

```text
feature/* -> Vercel preview for that branch
staging   -> shared integration preview
main      -> production deployment
```

Vercel automatically deploys a new production frontend when a commit reaches
`main`. Oracle does **not** automatically pull or restart. Backend deployment
remains manual until reviewed CI/CD is added.

Avoid connecting production previews to real patient data. Use staging
Supabase/backend environments for branch previews.

---

## 16. Connect Vercel to Oracle

The two required values must agree:

Vercel:

```env
NEXT_PUBLIC_API_BASE_URL=https://140-245-218-129.sslip.io
```

Oracle:

```env
CORS_ORIGINS=http://localhost:3000,https://ai4neuro.vercel.app
```

After editing Oracle:

```bash
sudo systemctl restart ai4neuro-backend.service

for attempt in $(seq 1 20); do
  curl -fsS http://127.0.0.1:8000/api/v1/health && break
  sleep 1
done
echo
```

Test the browser preflight from Oracle:

```bash
curl -sS -D - -o /dev/null \
  -X OPTIONS \
  http://127.0.0.1:8000/api/v1/users/me \
  -H 'Origin: https://ai4neuro.vercel.app' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization'
```

A 200 preflight with an
`access-control-allow-origin: https://ai4neuro.vercel.app` header proves CORS
for that origin.

If preflight succeeds but `GET /users/me` returns 401:

- the network and CORS are working;
- inspect the user's Supabase JWT and the backend Supabase secret;
- confirm the revoked key was replaced in `/etc/ai4neuro/backend.env`;
- restart the backend;
- do not weaken CORS or authentication to hide a 401.

---

## 17. Verification Performed on Staging

The following were observed working:

- Ubuntu patched and rebooted onto the new kernel;
- Python 3.10 virtual environment and CPU PyTorch;
- `pip check`: no broken requirements;
- EEG artifacts downloaded and readable;
- focused EEG/report test: 5 passed;
- MRI checkpoint deserialized and model initialized on CPU;
- MRI single-image forward pass succeeded;
- complete pre-CAT12 NIfTI slice/inference pipeline succeeded;
- real CAT12 segmentation succeeded and produced `mwp1`;
- Supabase client connected;
- all four storage buckets found;
- `analysis_sessions` table readable;
- systemd FastAPI service active;
- Caddy HTTPS active with a trusted certificate;
- OCI and host firewall rules correct;
- services and firewall persisted after reboot;
- public health, database, and storage checks succeeded;
- Vercel frontend login worked after the publishable-key correction;
- Oracle CORS was updated for the Vercel production origin;
- Oracle backend secret was rotated after the browser-exposure incident.

Warnings from the EEG PDF report about deprecated `fpdf2` `ln` parameters were
non-blocking. They should be cleaned up separately.

An earlier broad backend test snapshot reported 128 passed, 6 failed, and 1
skipped. The real EEG focused tests subsequently passed, but that does not erase
the unrelated failures. Re-run the complete suite on the current `main` before
each production release and investigate every remaining failure; a previously
observed area involved hospital-user deletion/cache behavior. Treat the numbers
as a historical snapshot, not a permanent expected result.

---

## 18. Normal Backend Deployment After `main` Changes

Merging into GitHub `main` does not alter Oracle by itself.

### 18.1 Pre-deployment checks

From the Oracle VM:

```bash
cd /tmp

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app fetch origin

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app status --short --branch

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app log \
  --oneline \
  --decorate \
  HEAD..origin/main
```

Stop if the server checkout has unexplained local modifications.

Record rollback information:

```bash
sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app rev-parse HEAD
```

### 18.2 Update

```bash
sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app switch main

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app pull --ff-only origin main
```

If requirements changed:

```bash
sudo -u ai4neuro \
  /opt/ai4neuro/venv/bin/pip install \
  -r /opt/ai4neuro/app/platform/backend/requirements/eeg.txt \
  -r /opt/ai4neuro/app/platform/backend/requirements/mri.txt \
  -r /opt/ai4neuro/app/platform/backend/requirements/dev.txt

sudo -u ai4neuro \
  /opt/ai4neuro/venv/bin/python -m pip check
```

Run proportionate tests:

```bash
cd /tmp
sudo -u ai4neuro env \
  HOME=/opt/ai4neuro \
  /bin/bash -c \
  'cd /opt/ai4neuro/app/platform/backend && /opt/ai4neuro/venv/bin/python -m pytest -q'
```

Restart and verify:

```bash
sudo systemctl restart ai4neuro-backend.service

for attempt in $(seq 1 30); do
  curl -fsS http://127.0.0.1:8000/api/v1/health && break
  sleep 1
done
echo

curl -fsS \
  https://140-245-218-129.sslip.io/api/v1/health
echo
```

### 18.3 Rollback

Prefer deploying a reviewed revert commit on `main`. For an emergency server
rollback, use the previously recorded commit without destroying Git history:

```bash
OLD_COMMIT='REPLACE_WITH_RECORDED_SHA'

sudo -u ai4neuro env HOME=/opt/ai4neuro \
  git -C /opt/ai4neuro/app switch \
  --detach "$OLD_COMMIT"

sudo systemctl restart ai4neuro-backend.service
```

After recovery, create/review a Git revert and return the server to `main`.
Do not use `git reset --hard` on an unexplained dirty checkout.

---

## 19. Local Development on macOS, Ubuntu, and Windows

Local development does not need the Oracle paths. Environment variables adapt
the same code to each machine.

### 19.1 Clone

macOS/Linux/WSL2:

```bash
git clone https://github.com/Asifussain/AI4Neuro.git
cd AI4Neuro
git switch main
```

Windows PowerShell:

```powershell
git clone https://github.com/Asifussain/AI4Neuro.git
Set-Location AI4Neuro
git switch main
```

### 19.2 Backend on macOS/Linux/WSL2

```bash
cd platform/backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
pip install torch torchvision \
  --index-url https://download.pytorch.org/whl/cpu
pip install \
  -r requirements/eeg.txt \
  -r requirements/mri.txt \
  -r requirements/dev.txt
cp .env.example .env
```

Set local absolute paths in `.env`.

macOS example:

```env
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=8000
CORS_ORIGINS=http://localhost:3000
AUTH_DEV_BYPASS=false

EEG_CHECKPOINT_ROOT=/Users/YOUR_NAME/projects/AI4Neuro/platform/backend/models/eeg/checkpoints
EEG_REFERENCE_DIR=/Users/YOUR_NAME/projects/AI4Neuro/platform/backend
EEG_SIDDHI_DIR=/Users/YOUR_NAME/projects/AI4Neuro/platform/backend/app/pipelines/eeg/siddhi
CONVIT_CHECKPOINT_PATH=/Users/YOUR_NAME/projects/AI4Neuro/platform/backend/models/mri/ConVit_checkpoint.pth
USE_CAT12_PREPROCESSING=false
```

Ubuntu/WSL2 example:

```env
EEG_CHECKPOINT_ROOT=/home/YOUR_NAME/projects/AI4Neuro/platform/backend/models/eeg/checkpoints
EEG_REFERENCE_DIR=/home/YOUR_NAME/projects/AI4Neuro/platform/backend
EEG_SIDDHI_DIR=/home/YOUR_NAME/projects/AI4Neuro/platform/backend/app/pipelines/eeg/siddhi
CONVIT_CHECKPOINT_PATH=/home/YOUR_NAME/projects/AI4Neuro/platform/backend/models/mri/ConVit_checkpoint.pth
USE_CAT12_PREPROCESSING=false
```

Start:

```bash
uvicorn app.main:app \
  --reload \
  --host 127.0.0.1 \
  --port 8000
```

### 19.3 Native Windows backend, only if required

PowerShell:

```powershell
Set-Location platform\backend
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
pip install torch torchvision `
  --index-url https://download.pytorch.org/whl/cpu
pip install `
  -r requirements\eeg.txt `
  -r requirements\mri.txt `
  -r requirements\dev.txt
Copy-Item .env.example .env
```

Native Windows path example:

```env
EEG_CHECKPOINT_ROOT=C:/Users/YOUR_NAME/projects/AI4Neuro/platform/backend/models/eeg/checkpoints
EEG_REFERENCE_DIR=C:/Users/YOUR_NAME/projects/AI4Neuro/platform/backend
EEG_SIDDHI_DIR=C:/Users/YOUR_NAME/projects/AI4Neuro/platform/backend/app/pipelines/eeg/siddhi
CONVIT_CHECKPOINT_PATH=C:/Users/YOUR_NAME/projects/AI4Neuro/platform/backend/models/mri/ConVit_checkpoint.pth
USE_CAT12_PREPROCESSING=false
```

Use forward slashes in `.env` where possible. WSL2 remains the preferred
backend environment.

### 19.4 Frontend on all operating systems

Use a Node version supported by Next.js 16. The earlier local Node 18.20.8 was
too old for the current frontend.

macOS/Linux/WSL2:

```bash
cd platform/frontend
npm install
cp .env.example .env.local
npm run dev
```

Windows PowerShell:

```powershell
Set-Location platform\frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Local frontend environment:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SB_PUBLISHABLE_KEY
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

### 19.5 Local CAT12 by operating system

| OS | Recommendation |
|---|---|
| Oracle/Ubuntu x86-64 | Canonical working deployment documented here |
| Ubuntu x86-64 workstation/WSL2 | Use the Linux standalone if the environment supports its system/runtime requirements |
| macOS Apple Silicon | Use the correct `maca64` CAT12/MATLAB Runtime build; do not copy Linux paths |
| macOS Intel | Use the matching Intel macOS build if supplied by CAT12/MathWorks |
| Native Windows | Use the matching Windows CAT12 standalone and MATLAB Runtime |

macOS Apple Silicon runtime libraries commonly use:

```text
/Applications/MATLAB/MATLAB_Runtime/R2023b/runtime/maca64
/Applications/MATLAB/MATLAB_Runtime/R2023b/bin/maca64
/Applications/MATLAB/MATLAB_Runtime/R2023b/sys/osmaca64
/Applications/MATLAB/MATLAB_Runtime/R2023b/extern/bin/maca64
```

These belong in the macOS `DYLD_LIBRARY_PATH` only for a local macOS runtime.
They have no effect on Oracle Linux.

Windows CAT12 example only:

```env
CAT12_ROOT=C:/CAT12/CAT12.9_R2023b_MCR_Win
CAT12_EXE=C:/CAT12/CAT12.9_R2023b_MCR_Win/cat12_standalone.bat
MCR_ROOT=C:/Program Files/MATLAB/MATLAB Runtime/R2023b
CAT12_OUTPUT_DIR=C:/tmp/neuro-platform/cat12
```

Do not modify application source to hard-code any OS path. Put machine-specific
paths in that machine's environment file.

---

## 20. Day-to-Day Operations

### Check all services

```bash
systemctl is-active \
  ai4neuro-backend.service \
  caddy.service \
  netfilter-persistent.service
```

### Check startup enablement

```bash
systemctl is-enabled \
  ai4neuro-backend.service \
  caddy.service \
  netfilter-persistent.service
```

### Check listeners

```bash
sudo ss -lntp \
  | grep -E ':(22|80|443|8000)\b'
```

Correct:

```text
22 on 0.0.0.0/[::]
80 and 443 owned by Caddy
8000 only on 127.0.0.1
```

### Backend logs

```bash
sudo journalctl \
  -u ai4neuro-backend.service \
  -n 150 \
  --no-pager
```

Follow:

```bash
sudo journalctl \
  -u ai4neuro-backend.service \
  -f
```

### Caddy logs

```bash
sudo journalctl \
  -u caddy \
  -n 150 \
  --no-pager
```

### Disk, memory, and model sizes

```bash
df -h
free -h
sudo du -sh \
  /opt/ai4neuro/models \
  /opt/cat12 \
  /opt/MATLAB/MATLAB_Runtime/R2023b \
  /tmp/neuro-platform
```

### Safe Caddy edit

```bash
sudo cp -a \
  /etc/caddy/Caddyfile \
  "/etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)"

sudo nano /etc/caddy/Caddyfile
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Reboot validation

```bash
sudo reboot
```

Reconnect and run:

```bash
systemctl is-active \
  ai4neuro-backend.service \
  caddy.service \
  netfilter-persistent.service

sudo iptables -L INPUT -n --line-numbers \
  | grep -E 'dpt:(22|80|443)|REJECT'

curl -fsS http://127.0.0.1:8000/api/v1/health
echo
```

Then test public HTTPS from a different computer/network.

---

## 21. Troubleshooting by Symptom

### 21.1 SSH: `Operation timed out` or `Network is unreachable`

Check in this order:

1. OCI instance status is Running.
2. Public IP is still correct.
3. Workstation has a default route/internet.
4. Current public IPv4 matches the OCI port-22 `/32` rule.
5. VCN route and security list are correct.
6. Port 22 remains before the host firewall rejection.

macOS:

```bash
curl -4 https://ifconfig.me
route -n get default
```

Windows PowerShell:

```powershell
(Invoke-RestMethod -Uri "https://ifconfig.me/ip").Trim()
Get-NetRoute -DestinationPrefix "0.0.0.0/0"
```

Do not run Linux commands such as `ss`, `ufw`, or `journalctl` on macOS. SSH
into Oracle first.

### 21.2 SSH: `Permission denied (publickey)`

- confirm the `-i` path points to the workstation's private key;
- do not use an Oracle path such as `/opt/ai4neuro/.ssh/...` on the Mac;
- confirm the matching public key exists in
  `/home/ubuntu/.ssh/authorized_keys`;
- confirm the username is `ubuntu`;
- fix private-key permissions.

### 21.3 Vercel shows `404 NOT_FOUND` although deployment is Ready

Check:

```text
Framework preset: Next.js
Root directory:  platform/frontend
Production branch: main
```

Redeploy after correcting settings. Deprecation warnings in npm output are not
the same as a build failure.

### 21.4 Login returns `Forbidden use of secret API key in browser`

The browser received an `sb_secret_...` key.

1. revoke it;
2. set `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `sb_publishable_...`;
3. redeploy Vercel;
4. issue a new server key for Oracle;
5. restart FastAPI.

### 21.5 Frontend says it cannot reach the API

Check Vercel:

```env
NEXT_PUBLIC_API_BASE_URL=https://140-245-218-129.sslip.io
```

Then from the workstation:

```bash
curl -fsS \
  https://140-245-218-129.sslip.io/api/v1/health
```

If health fails, inspect Caddy and firewall. If health succeeds but browser
calls fail, inspect CORS and the browser Network response.

### 21.6 Caddy listens but external 80/443 cannot connect

OCI security rules and Ubuntu iptables must both allow the port.

```bash
sudo ss -lntp | grep -E ':(80|443)\b'
sudo iptables -L INPUT -n -v --line-numbers
```

If only port 22 appears before a final `REJECT`, follow section 13.3 and persist
the verified rules.

### 21.7 Caddy certificate/user file error

Example:

```text
default.json: no such file or directory
```

This can be a transient first-attempt ACME account state. Confirm network
access, permissions, DNS, and logs:

```bash
sudo journalctl -u caddy -n 150 --no-pager
sudo systemctl restart caddy
```

Do not delete Caddy's data directory without a diagnosed reason.

### 21.8 `502 Bad Gateway`

Caddy is reachable but FastAPI is not:

```bash
sudo systemctl status ai4neuro-backend.service
curl -v http://127.0.0.1:8000/api/v1/health
sudo journalctl \
  -u ai4neuro-backend.service \
  -n 150 \
  --no-pager
```

Do not open public port 8000 as a workaround.

### 21.9 Backend is `active`, but immediate curl is refused

Uvicorn may still be importing the application. Use the polling loop in
section 12. If it never becomes healthy, inspect the journal.

### 21.10 Browser preflight is 400

The exact Vercel origin is missing from `CORS_ORIGINS`. Add it to
`/etc/ai4neuro/backend.env`, restart, wait for health, and repeat the OPTIONS
test.

### 21.11 Preflight is 200 but API is 401

CORS is fixed. Check:

- browser user session/JWT;
- backend `SUPABASE_SERVICE_ROLE_KEY`;
- whether that key was revoked;
- Supabase user/profile status and role.

Never replace a backend secret with the publishable key.

### 21.12 Model path exists for root but Python reports it missing

The service runs as `ai4neuro`. Test as that user:

```bash
cd /tmp
sudo -u ai4neuro \
  test -d /opt/ai4neuro/models/eeg/checkpoints \
  && echo ACCESSIBLE
```

Fix ownership/execute permission on every parent directory:

```bash
sudo chown -R ai4neuro:ai4neuro \
  /opt/ai4neuro/models/eeg
sudo chmod -R u=rwX,g=rX,o= \
  /opt/ai4neuro/models/eeg
```

### 21.13 Pytest fails with `/home/ubuntu/pytest.toml` permission denied

The service user inherited an inaccessible working directory. Run from `/tmp`
and `cd` inside the service-user shell as shown in section 8.5.

### 21.14 CAT12 exits 0 on `quit` but segmentation fails

The runtime launch test proves the binary starts; it does not prove the NIfTI
batch input is valid. Check:

- input is a real T1 NIfTI;
- use uncompressed `.nii` with the current manager;
- file is readable by `ai4neuro`;
- paths match section 3.1;
- timeout is at least 3600 seconds;
- logs include the generated `cat12_segment.m` error.

### 21.15 SSH connection resets during a long download/install

Use server-side `tmux`:

```bash
tmux new -s ai4neuro-setup
```

Detach with Ctrl+B, then D. Reconnect and:

```bash
tmux attach -t ai4neuro-setup
```

### 21.16 `command not found` after pasted output

Copy only commands. Lines such as:

```text
ubuntu@ai4neuro-backend-vnic:~$
See 'snap info <snapname>'
```

are prompt/output, not commands.

---

## 22. Changing Devices, Networks, IPs, Domains, or Accounts

### New laptop

1. generate a new key on the new laptop;
2. add only its public key to the VM;
3. add its network public IP `/32` to OCI;
4. test in a second terminal;
5. remove the old public key only after the new connection works.

### New Wi-Fi/VPN/public IP

Only the OCI port-22 source CIDR normally changes. The server, Vercel, Caddy,
and application environment do not change.

### New VM public IP

Update:

1. OCI reserved/public IP inventory;
2. temporary `sslip.io` hostname or production DNS A record;
3. `/etc/caddy/Caddyfile`;
4. Vercel `NEXT_PUBLIC_API_BASE_URL`;
5. redeploy Vercel;
6. any health monitoring;
7. documentation.

`CORS_ORIGINS` changes only if the **frontend** origin also changes.

### New frontend URL/custom domain

Update:

1. Vercel domain;
2. Supabase Auth site/redirect URL allowlist;
3. Oracle `CORS_ORIGINS`;
4. restart FastAPI;
5. monitoring and documentation.

The backend Caddy hostname does not need to change merely because the frontend
domain changes.

### New Supabase project

Recreate/apply:

- migrations;
- RLS policies;
- buckets and privacy;
- auth redirect settings;
- users/profiles/organization data;
- backend URL/secret/JWT settings;
- Vercel URL/publishable key.

Redeploy Vercel and restart FastAPI.

### New OCI/AWS account

Do not repeat the design work manually. Recreate:

- x86-64 Ubuntu VM and network;
- individual admin keys and firewall rules;
- directory/service layout;
- newly issued R2 and Supabase secrets;
- CAT12/MATLAB Runtime;
- Git checkout, venv, systemd, Caddy;
- DNS and monitoring.

Reuse:

- Git history;
- R2 model artifacts;
- documented paths;
- environment schema;
- tests and smoke-test procedure.

Follow
[`CLOUD_REBUILD_AND_MIGRATION_RUNBOOK.md`](./CLOUD_REBUILD_AND_MIGRATION_RUNBOOK.md)
for OCI-to-OCI or OCI-to-AWS cutover and rollback.

---

## 23. What Must Change Before Hospital Production

The current system is a successful staging deployment, not a production
security/compliance approval.

Required:

```text
[ ] Organization owns OCI/AWS, Vercel, Supabase, R2, GitHub, DNS, and billing
[ ] Personal trial resources are removed from the production dependency chain
[ ] Reserved/static public IP assigned
[ ] Organization-owned API and frontend domains configured
[ ] At least two administrators have individual IAM + SSH access and MFA
[ ] Secrets stored in an approved secrets manager and rotated
[ ] Separate development, staging, and production environments
[ ] Preview deployments cannot access production patient data
[ ] Backups and restore are tested
[ ] Monitoring, alerts, logs, and on-call ownership exist
[ ] Budget alerts exist
[ ] Rate limiting/WAF/DDoS controls assessed
[ ] Data residency, retention, deletion, encryption, consent, and audit reviewed
[ ] Logs and temporary files contain no patient identifiers
[ ] CAT12/ML validation and clinical-use claims independently reviewed
[ ] Queue/worker durability replaces in-process jobs when required
[ ] One complete anonymized EEG and MRI E2E test passes after every release
[ ] Disaster-recovery and cloud-account migration exercised
```

The local `ThreadPoolExecutor` can lose in-flight jobs during restarts. It is
acceptable for controlled staging/low concurrency, but a durable queue and
separate workers are the expected production evolution.

---

## 24. Quick Handoff Context for a Person or LLM

Copy this **redacted context**, not secret files:

```text
Project: AI4Neuro unified EEG/MRI platform
Repo: https://github.com/Asifussain/AI4Neuro.git
Production branch: main
Frontend: Vercel Next.js, root platform/frontend
Backend: FastAPI systemd service on OCI Ubuntu 22.04 x86-64
Public path: Caddy HTTPS -> 127.0.0.1:8000
Staging frontend: https://ai4neuro.vercel.app
Staging API: https://140-245-218-129.sslip.io
Backend service: ai4neuro-backend.service
Backend env: /etc/ai4neuro/backend.env (root:ai4neuro, 640)
Repo checkout: /opt/ai4neuro/app
Python: /opt/ai4neuro/venv
Models: /opt/ai4neuro/models
EEG root: /opt/ai4neuro/models/eeg/checkpoints
MRI checkpoint: /opt/ai4neuro/models/mri/ConVit_checkpoint.pth
CAT12: /opt/cat12/CAT12.9_R2023b_MCR_Linux
CAT12 launcher: .../run_spm25.sh
MATLAB Runtime: /opt/MATLAB/MATLAB_Runtime/R2023b/R2023b
Temporary jobs: /tmp/neuro-platform
R2 bucket/prefix: ai4neuro-models/ai4neuro
R2 endpoint: https://f3c30aedba5fd75851f5f721d11b77a6.r2.cloudflarestorage.com
Supabase buckets: raw-files, report-assets, reports, viewer-slices
Browser key: sb_publishable only
Backend key: sb_secret only
CORS must include the exact Vercel/custom frontend origin
Do not expose port 8000
CAT12 currently needs uncompressed .nii operational workaround
Never request or print secrets while troubleshooting
```

Before suggesting a fix, collect:

```bash
git -C /opt/ai4neuro/app status --short --branch
git -C /opt/ai4neuro/app rev-parse HEAD
systemctl is-active ai4neuro-backend caddy netfilter-persistent
sudo ss -lntp | grep -E ':(22|80|443|8000)\b'
curl -fsS http://127.0.0.1:8000/api/v1/health
sudo journalctl -u ai4neuro-backend.service -n 100 --no-pager
sudo journalctl -u caddy -n 100 --no-pager
```

Redact tokens, authorization headers, email addresses, patient identifiers,
signed storage URLs, and environment values before sharing output.

---

## 25. Related Documents

- [Oracle SSH and Network Access](./ORACLE_SSH_AND_NETWORK_ACCESS.md)
- [Caddy and HTTPS Setup](./CADDY_HTTPS_SETUP.md)
- [Production Hosting and DNS Reference](./PRODUCTION_HOSTING_DNS_REFERENCE.md)
- [Cloud Rebuild and Migration Runbook](./CLOUD_REBUILD_AND_MIGRATION_RUNBOOK.md)
- [Checkpoint Deployment](./CHECKPOINT_DEPLOYMENT.md)
- [CAT12 Setup](./CAT12_SETUP.md)
- [Team Onboarding](./TEAM_ONBOARDING.md)
- [Supabase and Application Setup](./SETUP_GUIDE.md)
- [Deployment Architecture](./deployment.md)
- [Pipeline Execution Reference](./PIPELINE_EXECUTION_REFERENCE.md)

When a focused document and this runbook disagree about the current Oracle
filesystem path, use section 3.1 of this runbook and verify the live VM before
editing production configuration.
