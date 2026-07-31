# AI4Neuro Cloud Rebuild and Migration Runbook

> Start with
> [`END_TO_END_DEPLOYMENT_RUNBOOK.md`](./END_TO_END_DEPLOYMENT_RUNBOOK.md) for
> the exact working staging inventory and commands. This document concentrates
> on ownership transfer and OCI/AWS migration; its generic filesystem examples
> must not override the verified live paths.

This runbook explains how to reproduce the AI4Neuro backend in:

1. a new, organization-owned Oracle Cloud Infrastructure (OCI) tenancy; or
2. an organization-owned AWS account.

It is intended to prevent the team from repeating the entire discovery process
each time a cloud account, administrator, laptop, public IP, or provider
changes.

This document is a deployment checklist, not authorization to use a personal or
borrowed account for hospital data. A production account must be owned and paid
for by the organization responsible for the platform.

Related documents:

- [`ORACLE_SSH_AND_NETWORK_ACCESS.md`](./ORACLE_SSH_AND_NETWORK_ACCESS.md)
- [`CAT12_SETUP.md`](./CAT12_SETUP.md)
- [`CHECKPOINT_DEPLOYMENT.md`](./CHECKPOINT_DEPLOYMENT.md)
- [`CADDY_HTTPS_SETUP.md`](./CADDY_HTTPS_SETUP.md)
- [`PRODUCTION_HOSTING_DNS_REFERENCE.md`](./PRODUCTION_HOSTING_DNS_REFERENCE.md)
- [`deployment.md`](./deployment.md)

## Direct Answer: Must We Repeat All the Work?

Some cloud resources must be created again in a different account because
cloud networks, VMs, public IPs, IAM permissions, disks, and secrets belong to
the original account. They cannot be assumed to exist in the new account.

The investigation and application work should not be repeated:

- The operating system and CPU architecture are known.
- The minimum useful memory is known.
- CAT12 and MATLAB Runtime versions are known.
- The Linux filesystem layout is known.
- Backend environment-variable names and production values are known.
- Firewall ports are known.
- Model artifacts are already stored outside Git.
- Supabase migrations and buckets are defined in the repository.
- Frontend/backend URL relationships are documented.

Expected effort after this first successful deployment:

| Rebuild type | Active administrator time | Additional unattended time |
|---|---:|---:|
| Manual rebuild in a new OCI tenancy | 2-4 hours | Downloads, installs, and smoke tests |
| OCI rebuild after bootstrap automation exists | 45-90 minutes | Downloads and smoke tests |
| First AWS migration | 3-6 hours | Downloads, DNS propagation, and full testing |
| Later AWS rebuild using infrastructure automation | 1-2 hours | Downloads and full testing |

These are planning estimates, not guarantees. CAT12 installation and the first
real MRI test are usually the longest tasks. The team should eventually create
Terraform and a server bootstrap script from this runbook; that will reduce
manual console work further.

## Production Ownership Prerequisites

Do not begin a production rebuild until all of the following have named owners:

| Item | Required owner |
|---|---|
| OCI tenancy or AWS account | Organization, not an individual developer |
| Billing and budgets | CTO, finance owner, or authorized billing administrator |
| Root/tenancy recovery | At least two trusted organization administrators |
| Domain and DNS | Organization-controlled registrar/DNS account |
| GitHub organization/repository | Organization with protected administrators |
| Supabase organization | Organization-controlled account |
| R2 model bucket | Organization-controlled Cloudflare account |
| Incident response | Named technical and hospital contacts |
| Data-protection decisions | Authorized legal/security owner |

Required account controls:

- Organization-owned email addresses
- MFA for every administrator
- At least two recovery administrators
- Individual user accounts; no shared cloud login
- Individual SSH keys; no shared private key
- Budget alerts before any production resource is launched
- Audit logging enabled
- A password manager or secrets manager for recovery material

Never place real patient scans in the temporary trial VM or in an account that
the organization does not control.

## Portable Target Configuration

Use the same application configuration on OCI and AWS:

```text
Operating system: Ubuntu 22.04 LTS, x86-64
Minimum memory:   16 GB
Initial workers:  1
Disk:             150 GB to start
Public ports:     80 and 443
Restricted port:  22 from approved administrator networks
Private app port: 8000 on 127.0.0.1 only
```

CAT12 and the MATLAB Runtime used by this project require the correct Linux
x86-64 build. Do not replace the server with an Arm VM merely because the Arm
shape is free or cheaper.

Use this filesystem layout on either cloud:

```text
/opt/ai4neuro/
  app/                    Git checkout
  models/
    eeg/
    mri/
  installers/             Optional cached installers; no credentials
  backups/                Temporary local staging only

/opt/cat12/               CAT12 standalone
/opt/MATLAB/              MATLAB Runtime
/tmp/neuro-platform/      Temporary job and CAT12 output
/etc/ai4neuro/            Protected runtime environment files
```

Portable production paths:

```env
APP_ENV=production
API_HOST=127.0.0.1
API_PORT=8000
AUTH_DEV_BYPASS=false

JOB_BACKEND=local
LOCAL_JOB_MAX_WORKERS=1
LOCAL_TMP_DIR=/tmp/neuro-platform
MAX_UPLOAD_MB=512

USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=true

EEG_CHECKPOINT_ROOT=/opt/ai4neuro/models/eeg/checkpoints
EEG_REFERENCE_DIR=/opt/ai4neuro/models/eeg/reference
EEG_SIDDHI_DIR=/opt/ai4neuro/app/platform/backend/app/pipelines/eeg/siddhi
EEG_USE_GPU=false

CONVIT_CHECKPOINT_PATH=/opt/ai4neuro/models/mri/ConVit_checkpoint.pth
CAT12_ROOT=/opt/cat12
CAT12_EXE=/opt/cat12/spm25
MCR_ROOT=/opt/MATLAB/MATLAB_Runtime/R2023b
CAT12_OUTPUT_DIR=/tmp/neuro-platform/cat12
CAT12_TIMEOUT_SECONDS=3600
MRI_USE_GPU=false
```

Secrets and deployment-specific values must be filled in separately:

```env
CORS_ORIGINS=https://app.example.org
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
```

Do not commit the completed environment file. Do not copy secrets from a
departing person's laptop. Issue organization-controlled credentials and rotate
old ones during migration.

## What Must Be Recreated and What Can Be Reused

| Component | New OCI tenancy | AWS | Reuse strategy |
|---|---|---|---|
| Cloud account and IAM | Recreate | Recreate | Organization users and MFA |
| Network | Recreate VCN | Create VPC | Use the CIDR plan in this document |
| Firewall | Recreate NSG/security list | Create security group | Same ports and sources |
| VM | Recreate compute instance | Create EC2 instance | Same Ubuntu/x86/RAM target |
| Server public IP | New reserved public IP | New Elastic IP | Update DNS during cutover |
| Boot disk | New boot volume | New EBS volume | Reinstall; restore only required data |
| Git repository | Reuse | Reuse | Deploy a reviewed commit/tag |
| Python application | Reuse | Reuse | Clone/build from Git |
| CAT12/MATLAB Runtime | Reinstall | Reinstall | Automate verified downloads/install |
| Model checkpoints | Reuse | Reuse | Sync from private R2 bucket |
| Supabase project | Reuse or replace | Reuse or replace | Decide separately from VM migration |
| Database schema | Reuse | Reuse | Apply versioned migrations |
| Domain | Reuse | Reuse | Change only the API DNS target |
| TLS certificate | Regenerate | Regenerate | Caddy/ACME on the new host |
| SSH private keys | Never copy between teammates | Never copy between teammates | Add each new public key |
| Logs/temp files | Usually do not migrate | Usually do not migrate | Preserve only required audit records |

## Option A: Rebuild in the CTO-Owned OCI Tenancy

### A1. Create the organization structure

In the CTO-owned tenancy:

1. Create a compartment named `ai4neuro-production`.
2. Add individual organization users or identity-domain groups.
3. Give only the deployment administrators the minimum required permissions.
4. Enable MFA and audit logging.
5. Create budget alerts before creating paid compute.

Do not share the tenancy administrator password with developers.

### A2. Recreate the network

Create:

```text
VCN name:       ai4neuro-vcn
VCN CIDR:       10.0.0.0/16
DNS label:      ai4neurovcn

Public subnet:  ai4neuro-public-subnet
Subnet CIDR:    10.0.0.0/24

Internet GW:    ai4neuro-igw
Route:          0.0.0.0/0 -> ai4neuro-igw
```

Security rules:

| Source | Protocol | Port | Purpose |
|---|---|---:|---|
| Approved administrator public IP `/32` | TCP | 22 | SSH |
| `0.0.0.0/0` | TCP | 80 | HTTP and certificate issuance |
| `0.0.0.0/0` | TCP | 443 | HTTPS API |

Do not open port 8000 publicly.

For a team, prefer an OCI Network Security Group attached to the backend VNIC
over placing every application rule in the subnet's default security list.

### A3. Recreate the compute instance

Starting configuration:

```text
Name:          ai4neuro-backend-prod
Image:         Canonical Ubuntu 22.04
Architecture:  x86-64
Shape:         Current flexible x86 shape with at least 16 GB RAM
Workers:       One CAT12 job at a time
Capacity:      On-demand
Fault domain:  Let Oracle choose
Boot volume:   150 GB, balanced performance
Public IPv4:   Enabled initially
IPv6:          Not required initially
```

One OCPU is acceptable for installation and a low-volume pilot but CAT12 will
be slow. Benchmark a real anonymized MRI before selecting the production OCPU
count. Resize based on measured duration and concurrency rather than guesses.

Paste each administrator's public SSH key. Never upload a private key.

### A4. Assign a reserved public IP

Do not base production DNS permanently on an automatically assigned ephemeral
address.

After the VM is running:

1. Reserve an organization-owned OCI public IPv4 address.
2. Assign it to the backend VNIC.
3. Record it in the internal deployment inventory.
4. Point `api.example.org` to that address only during cutover.

The old and new servers can run simultaneously while testing. DNS should remain
on the old server until the new server passes every acceptance test.

### A5. Bootstrap and deploy

Follow the provider-neutral deployment sequence later in this document. The
application commands and environment paths are the same as on AWS.

## Option B: Migrate to an Organization-Owned AWS Account

### OCI-to-AWS service mapping

| OCI concept | AWS equivalent |
|---|---|
| Tenancy | AWS Organization |
| Compartment | Dedicated AWS account plus tags |
| IAM identity domain/group | IAM Identity Center group/permission set |
| VCN | VPC |
| Public subnet | Public subnet |
| Internet Gateway | Internet Gateway |
| Route table | VPC route table |
| Network Security Group | EC2 security group |
| Compute instance | EC2 instance |
| Boot volume | EBS volume |
| Reserved public IP | Elastic IP |
| OCI Monitoring/Logging | CloudWatch |
| OCI Vault | Secrets Manager or Systems Manager Parameter Store |
| OCI Object Storage | S3 |
| OCI Budget | AWS Budget |

The application does not need to move its checkpoints from R2 merely because
the VM moves to AWS. R2 may remain the private model-artifact source. Review
contracts and data classification separately before placing patient data in
any object store.

### B1. Establish the AWS organization

1. Create an organization-owned AWS account, not a developer's personal
   account.
2. Enable MFA on the root user and store root recovery material securely.
3. Use IAM Identity Center for administrators and developers.
4. Do not create normal root-user access keys.
5. Enable CloudTrail and billing alerts.
6. Create an AWS Budget with email notifications.
7. Select the approved India region based on hospital, latency, resilience, and
   data-governance requirements.

AWS trial credits are for evaluation, not a production funding plan.

### B2. Create the AWS network

Create:

```text
VPC CIDR:       10.0.0.0/16
Public subnet:  10.0.0.0/24
Internet GW:    attached to the VPC
Route:          0.0.0.0/0 -> Internet Gateway
```

Create an EC2 security group:

| Source | Protocol | Port | Purpose |
|---|---|---:|---|
| Approved administrator public IP `/32` | TCP | 22 | SSH |
| `0.0.0.0/0` | TCP | 80 | HTTP and certificate issuance |
| `0.0.0.0/0` | TCP | 443 | HTTPS API |

Do not add port 8000. Consider AWS Systems Manager Session Manager later so SSH
can be removed entirely.

### B3. Create the EC2 server

Starting requirements:

```text
AMI:            Ubuntu Server 22.04 LTS
Architecture:   x86_64
Memory:         at least 16 GB
CPU:            select after CAT12 benchmark
Purchase:       On-Demand for initial production validation
Disk:           150 GB encrypted gp3 EBS
Public address: Elastic IP
```

Do not use an Arm/Graviton instance for the current CAT12 standalone package.
Do not select Spot for the only production server: a Spot interruption could
terminate an in-progress MRI job. Spot or AWS Batch can be evaluated later for
retryable, queued workers.

Use an EC2 IAM role for AWS service access instead of placing permanent AWS
access keys in the environment.

### B4. Keep the first AWS architecture simple

For the first migration:

```text
Vercel frontend
  -> HTTPS
EC2 + Caddy + FastAPI + one local job worker
  -> Supabase
  -> R2 model artifacts
```

After the single-host deployment is stable, split it:

```text
Always-running API
  -> durable queue
  -> on-demand x86 CAT12 worker
```

That split reduces idle CAT12 compute cost and prevents long MRI processing
from blocking the API, but it requires implementing a durable job backend and
retry behavior first.

## Provider-Neutral Server Deployment Sequence

Run the following sequence on either a new OCI or AWS Ubuntu server.

### 1. Establish administrative access

- Add each administrator's public SSH key.
- Confirm at least two trusted administrators can connect.
- Restrict port 22 to approved networks.
- Create a non-root application service account.
- Disable password-based SSH login after key access is verified.

See [`ORACLE_SSH_AND_NETWORK_ACCESS.md`](./ORACLE_SSH_AND_NETWORK_ACCESS.md).
The SSH key principles apply to AWS as well.

### 2. Patch and prepare the operating system

- Install current Ubuntu security updates.
- Install Git, Python, build tools, archive tools, Caddy, and monitoring tools.
- Create `/opt/ai4neuro`, `/etc/ai4neuro`, and `/tmp/neuro-platform`.
- Give the application service account only the permissions it requires.
- Add encrypted swap only if the benchmark shows it is needed; swap is not a
  replacement for sufficient RAM.
- Enable automatic security updates.

Record exact package names in a bootstrap script after the first successful
server installation.

### 3. Deploy a reviewed application revision

- A public repository may be deployed through read-only HTTPS without storing
  GitHub credentials on the server.
- Before every push to a public repository, verify that no environment files,
  cloud credentials, private keys, patient data, reports, model checkpoints, or
  proprietary artifacts are present.
- If the repository later becomes private, replace anonymous HTTPS access with
  a read-only GitHub deploy key or short-lived organization credential.
- Clone into `/opt/ai4neuro/app`.
- Check out a named production tag or immutable commit SHA.
- Do not deploy an unreviewed developer branch directly.
- Create the Python virtual environment or build the reviewed Docker image.
- Run automated backend tests before starting the service.

Record in the deployment inventory:

```text
Git commit:
Deployment date:
Administrator:
Cloud account:
Region:
Instance ID:
```

### 4. Restore model artifacts

Sync only versioned model artifacts from the private R2 bucket:

```text
/opt/ai4neuro/models/eeg/...
/opt/ai4neuro/models/mri/ConVit_checkpoint.pth
```

- Use newly issued read-only R2 credentials.
- Verify artifact size and checksum.
- Restrict filesystem permissions.
- Never place R2 credentials or checkpoint files in Git.

### 5. Install MATLAB Runtime and CAT12

- Install MATLAB Runtime R2023b/v232 for Linux x86-64.
- Install the matching Linux CAT12 standalone build.
- Keep the same paths on every server.
- Run the dry configuration check.
- Run a real smoke test with an approved anonymized T1 NIfTI.

Follow [`CAT12_SETUP.md`](./CAT12_SETUP.md).

### 6. Install production secrets

Create the protected backend environment from the repository's
`backend/.env.example`.

Rules:

- `APP_ENV=production`
- `AUTH_DEV_BYPASS=false`
- `LOCAL_JOB_MAX_WORKERS=1`
- Exact frontend origin in `CORS_ORIGINS`
- Service-role keys only on the backend
- No secret values in shell history, Git, screenshots, or documentation
- Issue fresh secrets when ownership or provider changes

Prefer the provider's secrets manager for production. If a protected
environment file is used initially, make it readable only by root and the
application service.

### 7. Start the service privately

Run FastAPI on:

```text
127.0.0.1:8000
```

Create a `systemd` service or reviewed container service that:

- starts after networking;
- restarts after failure;
- loads secrets without printing them;
- writes structured logs;
- does not run as root.

Caddy should expose only HTTPS and proxy to `127.0.0.1:8000`.

Before configuring Caddy, confirm that DNS resolves to the intended VM and that
public ports 80 and 443 are open. Validate the Caddyfile before every reload,
then verify both the HTTPS health endpoint and the private port bindings.
Follow [`CADDY_HTTPS_SETUP.md`](./CADDY_HTTPS_SETUP.md); do not expose port 8000
as a shortcut.

### 8. Validate before changing DNS

Use synthetic or approved anonymized data and verify:

```text
[ ] Health endpoint succeeds
[ ] Authentication succeeds
[ ] Authorization roles are enforced
[ ] Development bypass is disabled
[ ] EEG real-model smoke test succeeds
[ ] MRI ConViT smoke test succeeds
[ ] CAT12 produces the expected mwp1 output
[ ] One complete MRI UI workflow succeeds
[ ] Reports and signed URLs work
[ ] Temporary files are deleted
[ ] Service restarts after a VM reboot
[ ] Logs contain no secrets or patient contents
[ ] Backup/restore procedure is tested
[ ] Monitoring and budget alerts are received
```

Do not call the system production-ready merely because the homepage loads.

## Database and Patient-Data Migration

Moving the VM does not automatically require moving Supabase. Treat these as
separate decisions:

1. **Compute-only migration:** keep the existing organization-owned Supabase
   project and update the backend host.
2. **Full platform migration:** create a new organization-owned database and
   storage project, apply migrations, and move approved records through a
   controlled export/import process.

For a full data migration:

- Obtain authorization and define the legal basis.
- Inventory tables, buckets, retention periods, and data owners.
- Encrypt exports at rest and in transit.
- Verify record and object counts.
- Preserve required audit records.
- Never use public buckets for patient files.
- Destroy temporary exports after written verification.
- Rotate credentials after cutover.

Do not improvise a production patient-data transfer with `scp`, personal cloud
storage, email, or a developer laptop.

## DNS Cutover and Rollback

### Before cutover

1. Keep the old server running.
2. Reduce the API DNS TTL in advance.
3. Deploy and test the new server through a temporary hostname.
4. Pause or drain new jobs.
5. Let in-progress CAT12 jobs finish.
6. Take the required backup.
7. Run the final acceptance checklist.

### Cutover

1. Change `api.example.org` to the new reserved public IP.
2. Confirm the new TLS certificate.
3. Update backend CORS if the frontend origin changed.
4. Update the Vercel production API URL only if the API hostname changed.
5. Run login, upload, processing, result, and report tests.
6. Monitor errors, latency, disk, and job duration.

### Rollback

If a release-blocking problem occurs:

1. Stop accepting new jobs on the new server.
2. Restore DNS to the old server.
3. Confirm the old health endpoint and workflow.
4. Preserve new-server logs for investigation.
5. Reconcile any jobs created during the cutover window.

Never terminate the old server immediately after DNS changes. Keep it stopped
but recoverable for the approved rollback period.

## Decommissioning the Old Account

Only after written acceptance:

```text
[ ] DNS points to the organization-owned production server
[ ] No active jobs remain on the old host
[ ] Required data has been verified on the new platform
[ ] Required logs/backups have been retained
[ ] R2, Supabase, GitHub, and cloud credentials have been rotated
[ ] Old public IP and firewall rules are no longer used
[ ] Old VM and disks are securely removed by the account owner
[ ] Old account access is revoked
[ ] Billing confirms no unexpected resources remain
```

Deletion must be performed by the account owner after the exact targets have
been verified. Do not delete a VM or disk merely because DNS has changed.

## Automation Backlog

Complete these items after the first successful server deployment:

```text
[ ] Add a provider-neutral Ubuntu bootstrap script
[ ] Pin and verify CAT12/MATLAB Runtime download versions
[ ] Add checksum verification for all model artifacts
[ ] Add a systemd unit template for the backend
[ ] Add a reviewed Caddy configuration template
[ ] Add a deployment smoke-test command
[ ] Add Terraform for OCI networking/compute
[ ] Add Terraform for AWS VPC/security group/EC2/EBS/Elastic IP
[ ] Add GitHub Actions for tests and tagged deployments
[ ] Add backup and restore automation
[ ] Add monitoring, disk, job-duration, and failure alerts
[ ] Add a durable queue before scaling beyond one local worker
```

Do not put secrets, private SSH keys, real IP allowlists, patient identifiers,
or production environment files into Terraform state committed to Git.

## Recommended Immediate Strategy

Use the current trial VM only to finish a reproducible staging installation:

1. Complete Ubuntu, Python, model, MATLAB Runtime, and CAT12 setup.
2. Use synthetic or anonymized test data.
3. Record every successful command in a bootstrap script.
4. Measure CAT12 RAM use and processing time.
5. Run the end-to-end acceptance checks.
6. Rebuild from the script in the final organization-owned OCI tenancy or AWS
   account.

The current work is therefore not wasted. It establishes the portable,
provider-neutral deployment recipe that makes the final rebuild faster and
safer.
