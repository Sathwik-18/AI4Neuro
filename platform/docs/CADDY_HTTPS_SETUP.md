# Caddy and HTTPS Setup for the AI4Neuro Backend

This guide explains what Caddy is, why AI4Neuro uses it, how to configure it on
an Ubuntu VM, and what must change when the backend moves to another cloud
account, IP address, or domain.

It is written for teammates who have not previously configured a web server.
The same design works on Oracle Cloud Infrastructure (OCI) and AWS.

Related documents:

- [`ORACLE_SSH_AND_NETWORK_ACCESS.md`](./ORACLE_SSH_AND_NETWORK_ACCESS.md)
- [`PRODUCTION_HOSTING_DNS_REFERENCE.md`](./PRODUCTION_HOSTING_DNS_REFERENCE.md)
- [`CLOUD_REBUILD_AND_MIGRATION_RUNBOOK.md`](./CLOUD_REBUILD_AND_MIGRATION_RUNBOOK.md)
- [`deployment.md`](./deployment.md)

## What Caddy Is

Caddy is a web server and reverse proxy. For AI4Neuro, it has two jobs:

1. accept public web traffic on standard ports 80 and 443;
2. securely forward API requests to FastAPI on the same VM.

The production request path is:

```text
Browser or Vercel frontend
        |
        | HTTPS on public port 443
        v
      Caddy
        |
        | private HTTP inside the same VM
        v
127.0.0.1:8000
        |
        v
FastAPI / Uvicorn
```

`127.0.0.1` means "this machine only." Uvicorn is not reachable directly from
the internet when it listens on this address. Caddy is the controlled public
entry point.

## Why Caddy Is Needed

### HTTPS

Browsers and Vercel frontends should call an `https://` API. Caddy obtains and
renews a trusted TLS certificate automatically after:

- the hostname resolves to the VM;
- public TCP ports 80 and 443 reach Caddy; and
- the certificate authority can validate the hostname.

TLS encrypts traffic between the client and the VM. It does not replace
application authentication or authorization. FastAPI must still verify the
Supabase token and enforce hospital/user permissions.

### Standard public ports

Users should call:

```text
https://api.example.org
```

They should not call:

```text
http://VM_IP:8000
```

Port 8000 remains private. This avoids exposing the development server
directly and prevents browser mixed-content errors when the frontend uses
HTTPS.

### One stable public address

Caddy provides one public API origin even though the application behind it may
be restarted, upgraded, or eventually replaced with multiple workers.

## Terms Used in This Guide

| Term | Meaning |
|---|---|
| DNS | Maps a hostname such as `api.example.org` to an IP address. |
| TLS certificate | Proves the HTTPS hostname and enables encrypted traffic. |
| Reverse proxy | A public service that forwards requests to a private application. |
| Upstream | The private application behind Caddy; here it is `127.0.0.1:8000`. |
| Caddyfile | Caddy's human-readable configuration file at `/etc/caddy/Caddyfile`. |
| Reload | Applies a valid configuration without unnecessarily stopping Caddy. |

## Staging Hostname Versus Production Hostname

### Temporary staging

When the organization does not yet own a domain, `sslip.io` can resolve a
hostname containing an IPv4 address. Replace dots in the public IP with
dashes:

```text
Public IP:          203.0.113.25
Temporary hostname: 203-0-113-25.sslip.io
Temporary API URL:  https://203-0-113-25.sslip.io
```

The current staging VM was created with:

```text
Public IP:          140.245.218.129
Temporary hostname: 140-245-218-129.sslip.io
```

This is not a secret, but it is temporary. If OCI changes the VM's public IP,
the old `sslip.io` hostname will continue to resolve to the old address and
will stop reaching the VM. Construct a new temporary hostname from the new IP
and update Caddy, Vercel, and any test configuration.

Do not use `sslip.io` as the permanent hospital-production domain. It is a
third-party convenience DNS service and the team does not own the name.

### Production

Production requires:

```text
Organization-owned domain: ai4neuro.in
Reserved/static public IP: owned by the organization cloud account
Backend hostname:          api.ai4neuro.in
Frontend hostname:         app.ai4neuro.in
```

Create an `A` record:

```text
api.ai4neuro.in  A  <RESERVED_VM_PUBLIC_IP>
```

Use a reserved OCI public IP or AWS Elastic IP before depending on DNS. An
ephemeral IP can change during instance replacement and break both DNS and
HTTPS until the records are updated.

## Prerequisites

Complete all of these before changing the Caddyfile:

```text
[ ] Ubuntu VM is running
[ ] FastAPI systemd service is active
[ ] FastAPI listens only on 127.0.0.1:8000
[ ] Local FastAPI health request succeeds
[ ] Cloud firewall allows public TCP 80
[ ] Cloud firewall allows public TCP 443
[ ] Cloud firewall does not allow public TCP 8000
[ ] VM host firewall accepts TCP 80 and 443 before any final reject rule
[ ] Chosen hostname resolves to the VM public IP
[ ] VM can access the internet for certificate issuance
```

Check the private backend:

```bash
sudo systemctl --no-pager --full status ai4neuro-backend.service
curl -fsS http://127.0.0.1:8000/api/v1/health
echo
```

Check a temporary staging hostname:

```bash
getent ahostsv4 140-245-218-129.sslip.io
```

The returned IPv4 address must equal the VM's current public IP.

For a production domain, substitute the real hostname:

```bash
getent ahostsv4 api.ai4neuro.in
```

Do not request a certificate until DNS points to the intended VM.

## Install Caddy on Ubuntu

Use Caddy's official stable Ubuntu repository:

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

The package creates and enables `caddy.service`. Verify it:

```bash
caddy version
sudo systemctl --no-pager --full status caddy
```

Immediately after installation, Caddy serves its default HTTP page. Messages
saying automatic HTTPS was not applied are normal at this stage because the
default Caddyfile listens only on HTTP.

## Configure the Temporary Staging Hostname

First preserve the package's default configuration:

```bash
sudo cp -a \
  /etc/caddy/Caddyfile \
  /etc/caddy/Caddyfile.before-ai4neuro
```

Open the active configuration:

```bash
sudoedit /etc/caddy/Caddyfile
```

Replace its contents with:

```caddyfile
140-245-218-129.sslip.io {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8000
}
```

This file contains no Supabase keys, R2 credentials, SSH keys, or patient data.
Never place application secrets in the Caddyfile.

Format and validate before applying it:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
```

Do not reload if validation reports an error. Correct the Caddyfile and run the
validation again.

Apply a valid configuration without stopping the service:

```bash
sudo systemctl reload caddy
sudo systemctl --no-pager --full status caddy
```

Caddy will request the certificate automatically. Watch its logs:

```bash
sudo journalctl -u caddy -n 100 --no-pager
```

The first certificate can take a short time to issue.

## Verify HTTP, HTTPS, and the Reverse Proxy

Run the public URL checks from a different device or network client, such as an
administrator's laptop. Do not use a request from inside the OCI VM to its own
public hostname as the deciding test. OCI associates the public address with
the VNIC's private IP through its networking layer, and the VM may not have a
usable loop-back route to its own public address. An internal failure such as
`No route to host` can therefore occur even when external access works.

Keep the SSH session open. Open a second terminal on the administrator's
computer and run the following commands there.

Check that plain HTTP redirects to HTTPS:

```bash
curl -I http://140-245-218-129.sslip.io/api/v1/health
```

A redirect response such as `HTTP/1.1 308 Permanent Redirect` is expected.

Check the public HTTPS health endpoint:

```bash
curl -fsS \
  https://140-245-218-129.sslip.io/api/v1/health
echo
```

Expected application response:

```json
{"status":"ok","timestamp":"..."}
```

Also verify the backend remains private:

```bash
sudo ss -lntp | grep -E ':(80|443|8000)\b'
```

The intended listeners are:

```text
80 and 443: Caddy, public
8000:       Uvicorn on 127.0.0.1 only
```

Do not add an OCI or AWS public ingress rule for port 8000.

## Switch from the Temporary Hostname to the Production Domain

Perform this only after the organization controls the cloud account, reserved
IP, domain, and DNS.

1. Assign the reserved/static IP to the production VM.
2. Create the production `A` record.
3. Wait until the hostname resolves to that IP.
4. Back up the working staging Caddyfile.
5. Replace only the site address in `/etc/caddy/Caddyfile`.
6. Validate and reload Caddy.
7. Verify HTTPS before changing the frontend.

Production Caddyfile:

```caddyfile
api.ai4neuro.in {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8000
}
```

Apply it:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -fsS https://api.ai4neuro.in/api/v1/health
echo
```

Caddy obtains a new certificate for the production hostname. A certificate for
the old hostname cannot be reused for a different hostname.

## Connect Vercel After HTTPS Works

Do not point the frontend to the backend until the public HTTPS health request
succeeds.

Vercel frontend environment:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.ai4neuro.in
```

For temporary staging:

```env
NEXT_PUBLIC_API_BASE_URL=https://140-245-218-129.sslip.io
```

The backend CORS value is the frontend's origin, not the API's origin:

```env
CORS_ORIGINS=https://app.ai4neuro.in
```

For a Vercel staging deployment, use its exact assigned frontend origin. Do not
use `*` in production. After changing `/etc/ai4neuro/backend.env`, restart the
backend and verify it:

```bash
sudo systemctl restart ai4neuro-backend.service
sudo systemctl --no-pager --full status ai4neuro-backend.service
curl -fsS http://127.0.0.1:8000/api/v1/health
echo
```

Never copy `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, R2 credentials,
or any other server secret into a `NEXT_PUBLIC_*` variable.

## Normal Caddy Operations

### Check status

```bash
sudo systemctl --no-pager --full status caddy
```

### Inspect recent logs

```bash
sudo journalctl -u caddy -n 100 --no-pager
```

### Follow live logs

```bash
sudo journalctl -u caddy -f
```

Press `Ctrl+C` to stop following logs. This does not stop Caddy.

### Validate after every configuration edit

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

### Apply a valid edit

```bash
sudo systemctl reload caddy
```

Prefer `reload` for configuration changes. A reload keeps the running service
available while applying the new configuration.

### Update Caddy

```bash
sudo apt update
sudo apt install --only-upgrade caddy
sudo systemctl --no-pager --full status caddy
```

Test the public health endpoint after an upgrade.

### Certificate renewal

Caddy renews managed certificates automatically. Do not manually copy
certificate files or create a separate cron job. Caddy's service data normally
lives under:

```text
/var/lib/caddy/
```

Do not edit or delete this directory during normal operation.

## Troubleshooting

### DNS returns the wrong address

```bash
getent ahostsv4 <API_HOSTNAME>
```

Fix DNS or use the correct `sslip.io` hostname. Do not repeatedly reload Caddy
while the hostname points elsewhere.

### Caddy cannot obtain a certificate

Check:

```text
1. DNS resolves to this VM.
2. OCI/AWS ingress allows TCP 80 and 443 from 0.0.0.0/0.
3. No other service is occupying ports 80 or 443.
4. Caddy is running.
5. The VM has outbound internet access.
```

Inspect:

```bash
sudo ss -lntp | grep -E ':(80|443)\b'
sudo ufw status verbose
sudo iptables -L INPUT -n -v --line-numbers
sudo journalctl -u caddy -n 150 --no-pager
```

An OCI Ubuntu image can have a raw `iptables` rejection rule even when UFW
reports `Status: inactive`. If Caddy listens on 80/443 but the INPUT chain
allows only port 22 before a final `REJECT`, internet and certificate-authority
requests will be rejected by the VM.

Back up the current rules before changing them:

```bash
sudo iptables-save \
  | sudo tee /root/iptables-before-ai4neuro-web.rules >/dev/null
```

Insert TCP 80 and 443 acceptance rules immediately before the final rejection
rule. The rule number depends on the current table; inspect it first. For
example, if `REJECT` is initially rule 5:

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

Verify that port 22, port 80, and port 443 are accepted before `REJECT`.
Do not delete or replace the working SSH rule.

After external HTTP/HTTPS access succeeds, persist the verified rules:

```bash
sudo netfilter-persistent save
sudo grep -nE -- '--dport (22|80|443)' /etc/iptables/rules.v4
```

If `netfilter-persistent` is unavailable, stop and install/configure the
distribution's supported persistent-firewall mechanism before rebooting. A
runtime-only `iptables` edit is lost at reboot.

### Public request returns `502 Bad Gateway`

Caddy is reachable but FastAPI is unavailable. Check the private upstream:

```bash
sudo systemctl --no-pager --full status ai4neuro-backend.service
curl -v http://127.0.0.1:8000/api/v1/health
sudo journalctl -u ai4neuro-backend.service -n 100 --no-pager
```

Do not solve a 502 by opening public port 8000.

### HTTPS works but the browser reports a CORS error

Caddy and TLS are working. Check `CORS_ORIGINS` in the protected backend
environment. It must contain the exact frontend origin, including `https://`
and excluding URL paths.

Examples:

```text
Correct:   https://app.ai4neuro.in
Incorrect: https://api.ai4neuro.in
Incorrect: https://app.ai4neuro.in/some/path
Incorrect: *
```

Restart the backend after changing its protected environment file.

### Caddy configuration is invalid

Do not reload. Restore the backup if necessary:

```bash
sudo cp -a \
  /etc/caddy/Caddyfile.before-ai4neuro \
  /etc/caddy/Caddyfile

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

This restores Caddy's original page, not the AI4Neuro reverse proxy.

## Security and Production Limitations

Caddy provides encrypted transport and a controlled reverse proxy. It does not
by itself provide:

- Supabase authentication;
- hospital/user authorization;
- malware scanning;
- API rate limits;
- a web application firewall;
- DDoS protection;
- backups;
- patient-data retention controls;
- monitoring and incident response.

These controls must be designed separately before hospital production.

For production:

```text
[ ] Organization owns the cloud account and billing
[ ] Organization owns the domain and DNS account
[ ] VM uses a reserved/static public IP
[ ] At least two administrators have individual access
[ ] Caddy configuration is backed up and reviewed
[ ] HTTPS health check is monitored
[ ] FastAPI remains bound to 127.0.0.1:8000
[ ] Port 8000 is absent from public ingress rules
[ ] CORS allows only approved frontend origins
[ ] Application authentication and authorization are tested
[ ] Logs contain no secrets or patient contents
[ ] Rate limiting/WAF and incident response are assessed
```

## Current Staging State

As of the initial OCI staging setup on 25 July 2026:

```text
[x] Caddy 2.11.4 installed from the official stable repository
[x] caddy.service enabled and running
[x] FastAPI service enabled and running
[x] FastAPI health endpoint succeeds on 127.0.0.1:8000
[x] Supabase database health check succeeds
[x] Supabase storage health check succeeds
[x] OCI ingress includes public ports 80 and 443
[x] Ubuntu host firewall accepts ports 80 and 443 before its reject rule
[x] Ubuntu firewall rules saved with `netfilter-persistent`
[x] Public port 8000 is not exposed
[x] Temporary hostname DNS verified
[x] AI4Neuro Caddyfile installed
[x] Trusted TLS certificate obtained successfully
[x] Public HTTPS health endpoint verified from an external client
[x] Public database health endpoint verified
[x] Public storage health endpoint verified with all required buckets
[x] Backend, Caddy, firewall, and external HTTPS verified after VM reboot
[x] Vercel frontend origin added to backend CORS
[x] Vercel frontend pointed to the HTTPS API
```

Update this checklist as staging progresses. Do not interpret staging success
as approval for real hospital or patient data.

## Official References

- [Caddy installation on Debian and Ubuntu](https://caddyserver.com/docs/install#debian-ubuntu-raspbian)
- [Caddy `reverse_proxy` directive](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [`sslip.io` IP-based DNS and TLS behavior](https://sslip.io/)
