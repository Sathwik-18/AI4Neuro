# Oracle SSH and Network Access Guide

This guide explains how the AI4Neuro team should control administrative access
to the Oracle backend VM. It is written for teammates who have not previously
managed a cloud server.

For the public HTTPS/API side of the same VM, see
[`CADDY_HTTPS_SETUP.md`](./CADDY_HTTPS_SETUP.md).

The most important distinction is:

- An Oracle ingress rule decides **which internet connections may reach the
  server's SSH port**.
- An SSH key decides **which administrator is allowed to sign in**.

Both checks must succeed. Allowing an IP address does not give that person an
account or private key, and possessing an SSH key does not bypass the Oracle
network firewall.

## What is sensitive?

| Item | Sensitive? | Handling |
|---|---|---|
| Oracle VM public IP | Moderately | It may be documented internally, but do not treat it as a password. |
| Administrator public IP | Moderately | Keep it in Oracle firewall rules and internal infrastructure documentation. |
| SSH public key (`.pub`) | No secret | Safe to copy to Oracle or send to the server administrator. |
| SSH private key | **Yes** | Never send it to another person or commit it to Git. Keep an encrypted backup. |
| Oracle account password/recovery codes | **Yes** | Store in a password manager and enable MFA. |
| R2 and Supabase server credentials | **Yes** | Store only in protected server/Vercel environment variables, never in Git. |

## Prerequisites

Before configuring SSH access, have:

1. An Oracle Cloud account with MFA enabled.
2. Permission to manage the `ai4neuro-production` compartment and its VCN.
3. Access to the Oracle Console in a browser.
4. The public IP of the network from which administration will happen.
5. An SSH client. macOS, Linux, and current Windows PowerShell all include one.
6. A password manager or encrypted backup location for the private SSH key.

The laptop does not have to be a Mac. SSH works from macOS, Windows, or Linux.

## Public IP allowlisting explained

When a laptop accesses the internet through home Wi-Fi, office Wi-Fi, a mobile
hotspot, or a VPN, websites normally see the network's public IP address. Oracle
can allow SSH only from that public IP.

To display the current public IPv4 address, run:

```bash
curl -4 https://ifconfig.me
```

If the command prints:

```text
203.0.113.25
```

the Oracle source CIDR is:

```text
203.0.113.25/32
```

`/32` means "only this one IPv4 address."

The example address above is documentation only. Always use the value returned
for the administrator's current network.

### What changes the public IP?

- Changing from home Wi-Fi to office Wi-Fi usually changes it.
- Switching to a mobile hotspot usually changes it.
- Enabling a VPN usually changes it to the VPN exit IP.
- An ISP may periodically change a home's public IP even when the router and
  laptop have not changed.
- Replacing a laptop while remaining on the same network does not necessarily
  change it.

Therefore, the allowlist controls a **network location**, not a specific laptop.

## Configure the Oracle ingress rules

Open:

```text
Oracle Console
→ Networking
→ Virtual Cloud Networks
→ ai4neuro-vcn
→ Security Lists
→ Default Security List for ai4neuro-vcn
→ Ingress Rules
```

Remove any TCP port `22` rule whose source is `0.0.0.0/0`. Keep Oracle's
existing ICMP rules.

Add these stateful ingress rules:

| Source CIDR | Protocol | Destination port | Purpose |
|---|---|---:|---|
| `ADMIN_PUBLIC_IP/32` | TCP | 22 | SSH administration from the approved network |
| `0.0.0.0/0` | TCP | 80 | Public HTTP and certificate validation |
| `0.0.0.0/0` | TCP | 443 | Public HTTPS API |

For every rule:

- Leave **Stateless** unchecked so the rule is stateful.
- Leave **Source port** as All.
- Enter only the destination port shown above.

Do not expose backend port `8000`. Caddy will accept public traffic on ports 80
and 443 and proxy it privately to `127.0.0.1:8000`.

Caddy is the VM's public HTTPS entry point. It automatically manages the TLS
certificate for the configured hostname and forwards requests to FastAPI
inside the same VM. Port 80 is also required so Caddy can redirect HTTP to
HTTPS and complete HTTP-based certificate validation. The step-by-step
installation, DNS, validation, and troubleshooting procedure is in
[`CADDY_HTTPS_SETUP.md`](./CADDY_HTTPS_SETUP.md).

Keep the existing outbound/egress rule that permits the server to access the
internet. It is needed for operating-system updates, GitHub, R2 model downloads,
Supabase, and HTTPS certificate renewal.

## SSH keys explained

An SSH key pair contains:

- a private key that remains with one administrator;
- a public key placed on the Oracle VM.

Never share one private key between teammates. Each administrator should
generate a separate pair so access can be removed for one person without
affecting everyone else.

### Is the SSH key device-specific?

The private key is a file stored on a device. Oracle does not receive the
private key; the VM stores only its matching public key.

This means:

- A different laptop cannot connect merely because it uses the same Oracle
  account or the same Wi-Fi.
- A new laptop needs either a securely restored copy of the existing private
  key or, preferably, its own new key pair whose public key has been added to
  the VM.
- A new network also needs its public IP allowed by Oracle. The network
  `/32` rule and the SSH key are independent checks.
- Reinstalling an operating system can destroy the only private-key copy if it
  was not backed up first.

For one administrator replacing a device, restoring an existing key from a
properly encrypted backup is technically valid. Generating a new key for the
new device is safer because the old key can then be removed. Never copy one
private key to multiple teammates.

### Generate a key on macOS

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -a 100 -C "administrator-name-ai4neuro" -f ~/.ssh/ai4neuro_oracle
chmod 600 ~/.ssh/ai4neuro_oracle
chmod 644 ~/.ssh/ai4neuro_oracle.pub
```

Copy only the public key to the clipboard:

```bash
pbcopy < ~/.ssh/ai4neuro_oracle.pub
```

### Generate a key on Ubuntu or another Linux workstation

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -a 100 -C "administrator-name-ai4neuro" -f ~/.ssh/ai4neuro_oracle
chmod 600 ~/.ssh/ai4neuro_oracle
chmod 644 ~/.ssh/ai4neuro_oracle.pub
```

Display the Linux public key so it can be copied:

```bash
cat ~/.ssh/ai4neuro_oracle.pub
```

It is safe to copy the `.pub` output. Do not display or copy the file without
the `.pub` suffix.

### Generate a key on Windows

Open a normal Windows PowerShell terminal, not WSL, and run:

```powershell
New-Item -ItemType Directory -Force "$HOME\.ssh" | Out-Null
ssh-keygen -t ed25519 -C "administrator-name-ai4neuro" -f "$HOME\.ssh\ai4neuro_oracle"
```

Copy only the Windows public key to the clipboard:

```powershell
Get-Content "$HOME\.ssh\ai4neuro_oracle.pub" | Set-Clipboard
```

The file ending in `.pub` is the public key. The file without `.pub` is the
private key.

Protect the private key with a passphrase and store an encrypted backup. Do not
put either the real private key or its contents in GitHub, Slack, WhatsApp,
email, tickets, or screenshots.

## Changing networks in the future

If an administrator moves to another network:

1. Sign in to the Oracle Console using the Oracle account and MFA.
2. Determine the new network's public IPv4 address.
3. Open the default security list.
4. Edit the port 22 rule.
5. Replace the old source with `NEW_PUBLIC_IP/32`.
6. Save the rule.
7. Connect to the VM using the administrator's existing private SSH key.

The Oracle firewall can be updated from a browser. Existing SSH access is not
required to change this network rule.

If the old and new networks must work temporarily, create two separate `/32`
port 22 rules. Remove the old one after the move.

## Changing laptops in the future

The safest migration is performed while the old device can still connect:

1. Generate a new key pair on the replacement laptop.
2. Determine the replacement laptop's network public IP and add its `/32`
   port 22 rule in Oracle.
3. Copy only the replacement laptop's `.pub` key.
4. Keep the existing SSH session open.
5. In the existing session, open the VM's authorized-key file:

   ```bash
   sudoedit /home/ubuntu/.ssh/authorized_keys
   ```

6. Paste the new public key on a new line, save, and exit.
7. Test a new SSH connection from the replacement laptop.
8. Only after the new connection succeeds, remove the old public-key line if
   the old laptop will no longer be trusted.

The initial public key pasted into Oracle's Create Instance page is installed
for the default Ubuntu image user named `ubuntu`. It does not give access to
the application service account named `ai4neuro`.

Alternatively, securely restore the existing private key from an encrypted
backup. Never send the private key through a normal messaging service.

Losing the only private key is recoverable through Oracle instance-console or
boot-volume recovery procedures, but that is significantly harder. Maintain at
least two trusted administrative recovery paths before production launch.

### Connect from macOS or Ubuntu/Linux

```bash
chmod 600 ~/.ssh/ai4neuro_oracle
ssh -i ~/.ssh/ai4neuro_oracle ubuntu@ORACLE_RESERVED_PUBLIC_IP
```

### Connect from Windows PowerShell

```powershell
ssh -i "$HOME\.ssh\ai4neuro_oracle" ubuntu@ORACLE_RESERVED_PUBLIC_IP
```

If Windows OpenSSH reports that the private-key permissions are too open, run:

```powershell
$key = "$HOME\.ssh\ai4neuro_oracle"
icacls $key /inheritance:r
icacls $key /grant:r "$($env:USERNAME):(R)"
```

Then retry the `ssh` command.

### If the old device is already unavailable

Use this order:

1. If an encrypted private-key backup exists, restore it to the correct
   location on the new device, apply the OS-specific permissions above, and
   update the Oracle `/32` network rule.
2. If another authorized administrator exists, have that administrator add
   the new device's public key to `/home/ubuntu/.ssh/authorized_keys`.
3. If neither option exists, use an Oracle Instance Console Connection or
   boot-volume recovery procedure to add a new public key. This requires
   Oracle Console permissions and is an emergency recovery process, not the
   normal access method.

Do not temporarily share another administrator's private key to avoid this
process.

## Adding teammates

Application users and most developers do not need SSH. They should use the
Vercel frontend and GitHub pull requests.

For every teammate who genuinely needs server administration:

1. Give them an individual Oracle IAM account and require MFA.
2. Have them generate their own SSH key pair.
3. Receive only their public `.pub` key.
4. Create a separate `/32` port 22 rule for their approved network.
5. Add their public key to their own Linux account, or to the shared
   administrative account only during the initial small-team phase.
6. Record who owns each firewall rule and SSH public key.
7. Remove both items immediately when access is no longer required.

Never give teammates the backend service account, R2 token, Supabase
service-role key, or another person's SSH private key.

## Administrators with frequently changing IP addresses

Use one of these approaches, in order of preference:

1. Manually update the `/32` Oracle rule when the network changes.
2. Use an office VPN or another VPN with a fixed, trusted exit IP.
3. Configure Oracle Bastion or a private access network after the initial VM is
   working.

Opening SSH to `0.0.0.0/0` exposes it to continuous internet scanning. Do this
only as a short emergency measure, keep password authentication disabled, and
restore a restricted `/32` rule immediately after access is recovered.

## Preventing lockout

Before changing firewall rules or SSH keys:

1. Keep the existing SSH session open.
2. Open a second terminal and test a new connection.
3. Confirm the new connection succeeds.
4. Only then close the original session or remove the previous rule/key.

Also verify that the Oracle account itself has MFA and securely stored recovery
codes. Oracle Console access is the primary way to repair an incorrect network
rule.

## Initial AI4Neuro policy

For the first controlled deployment:

- Allow port 22 only from each infrastructure administrator's `/32` address.
- Allow ports 80 and 443 publicly.
- Do not expose port 8000.
- Use SSH keys only; do not enable password authentication.
- Set `LOCAL_JOB_MAX_WORKERS=1`.
- Limit Oracle SSH access to one or two infrastructure administrators.
- Let all other teammates use GitHub and the deployed application.
