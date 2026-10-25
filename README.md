# Beacon — Minecraft Server Control

Beacon is a private, secure, mobile-first web dashboard designed for managing a friends-only Minecraft server hosted on an Oracle Cloud Infrastructure (OCI) Virtual Machine. It deploys seamlessly on Cloudflare Pages (React + Vite static frontend with Cloudflare Pages Functions backend).

A single shared password protects everything, backed by strict security safeguards, constant-time PBKDF2 hashing, HMAC session tokens, IP rate limiting, CSRF verification, and zero inline assets under a strict Content Security Policy.

---

## Architecture & Features

- **Frontend**: Vite + React + TypeScript + Tailwind CSS with `lucide-react` icons (zero emojis).
- **Backend**: Cloudflare Pages Functions running on Cloudflare's V8 runtime using Web Crypto exclusively (no Node APIs, no crypto npm packages).
- **Storage**: Cloudflare KV (`DASH_KV`) for session state, rate limits, action cooldowns, and audit logs.
- **Self-Hosted Typography**: Fully self-hosted Inter fonts bundled in `public/fonts/` (no Google Fonts CDN or third-party tracking).
- **OCI REST Integration**: Native Cavage HTTP request signing (RSASSA-PKCS1-v1_5 + SHA-256) targeting OCI endpoints for instance lifecycle states, power actions (`START`, `SOFTSTOP`, `SOFTRESET`), and VNIC dynamic public IP discovery.
- **Dual Server State**: Displays both OCI VM lifecycle state and real-time Minecraft server status (via isolated `mcsrvstat.us` lookup cached in KV).
- **Compute & Free-Tier Migration Telemetry**: Live OCPU & RAM allocation stats, $300 trial credit burn rate estimation, and Oracle Always Free Ampere capacity comparison.
- **Audit Log**: Capped 100-entry audit trail stored in KV, showing last 20 actions with SHA-256 masked client IP identifiers.
- **Safety Rails**:
  - Enforced 30-second cooldown between power actions.
  - Active player warning: if players are online, server shutdown requires typing `STOP` to confirm.
  - Brute force protection: 5 failed attempts locks client IP for 15 minutes; 25 failed attempts triggers global 15-minute lock; 800ms delay on failed attempts.
- **Phase 2 Ready**:
  - Scheduled Auto-Stop Cloudflare Worker (stops idle VM after 30 minutes with 0 players).
  - Cloudflare Turnstile bot protection for the login screen.

---

## Environment Variables

Configure these variables in `.dev.vars` for local development or in the Cloudflare Pages dashboard under **Settings > Environment variables**:

| Variable Name | Description | Example / Format |
|---|---|---|
| `OCI_TENANCY_OCID` | Oracle Cloud tenancy identifier | `<your-tenancy-ocid>` |
| `OCI_USER_OCID` | Oracle Cloud API user identifier | `<your-user-ocid>` |
| `OCI_FINGERPRINT` | Fingerprint of the uploaded RSA public key | `<your-rsa-fingerprint>` |
| `OCI_PRIVATE_KEY_B64` | Base64-encoded string of the PKCS#8 private key | `<base64-pkcs8-private-key>` |
| `OCI_REGION` | OCI Region identifier | `us-ashburn-1` |
| `OCI_INSTANCE_OCID` | Instance OCID for the Minecraft VM | `<your-instance-ocid>` |
| `OCI_COMPARTMENT_OCID` | Compartment OCID containing the instance | `<your-compartment-ocid>` |
| `PASSWORD_HASH` | PBKDF2-SHA256 password hash (100,000 iterations) | `<generated-pbkdf2-hash>` |
| `SESSION_SECRET` | 32+ character secret for HMAC-SHA256 cookies | `<random-32-character-secret>` |
| `TRIAL_END` | ISO 8601 date when Oracle Free Trial expires | `2099-12-31T00:00:00Z` |
| `BACKUP_URL` *(Optional)* | Oracle Cloud Object Storage download URL | `<your-pre-authenticated-request-url>` |
| `TURNSTILE_SECRET` *(Optional)* | Cloudflare Turnstile secret key (Phase 2) | `<turnstile-secret-key>` |
| `TURNSTILE_SITEKEY` *(Optional)* | Cloudflare Turnstile public sitekey (Phase 2) | `<turnstile-site-key>` |

### Storage Bindings
- **Cloudflare KV Binding Name**: `DASH_KV` (stores session tokens, power cooldowns, rate limits, and audit logs).

---

## Generating the Password Hash

Beacon stores only PBKDF2-SHA256 hashes with 100,000 iterations and a fresh 16-byte random salt. Generate your hash using the included helper script:

```bash
npm run hash-password "your-strong-password"
# Output format:
# pbkdf2$100000$<salt>$<hash>
```

Copy the generated output string into `PASSWORD_HASH`.

---

## OCI API Key Generation (PKCS#8)

OCI requires an RSA private key. Web Crypto requires the private key to be in **PKCS#8** format:

1. Generate a 2048-bit RSA private key:
   ```bash
   openssl genrsa -out oci_api_key.pem 2048
   ```

2. Convert the private key to PKCS#8 format without encryption:
   ```bash
   openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in oci_api_key.pem -out oci_api_key_pkcs8.pem
   ```

3. Export the public key in PEM format:
   ```bash
   openssl rsa -pubout -in oci_api_key.pem -out oci_api_key_public.pem
   ```

4. Upload `oci_api_key_public.pem` to your user in the Oracle Cloud Console:
   - Navigate to **Profile > User Settings > API Keys > Add API Key**.
   - Note the **Fingerprint**, **User OCID**, and **Tenancy OCID** shown.

5. Convert your `oci_api_key_pkcs8.pem` to a single-line base64 string for `OCI_PRIVATE_KEY_B64`:
   ```bash
   # On Linux/macOS:
   base64 -w 0 oci_api_key_pkcs8.pem

   # On Windows (PowerShell):
   [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("oci_api_key_pkcs8.pem"))
   ```

---

## World Saves & Server Migration Backups

Beacon includes a dedicated **World Archive & Migration** card and `/api/backup` route allowing admins and friends to download the latest world save (`minecraft-world-latest.tar.gz`) with a single click.

Because Cloudflare R2 provides **10 GB of free storage with $0 egress fees**, your world saves remain safely preserved even when you terminate or recreate your Oracle Cloud VM.

### 1. Create Cloudflare R2 Bucket
1. In the Cloudflare Dashboard, go to **R2 Object Storage**.
2. Click **Create bucket**, name it `beacon-backups`, and click **Create bucket**.
3. In your Beacon project settings on Cloudflare:
   - Go to **Settings > Bindings** (or **Functions**).
   - Click **Add > R2 bucket binding**:
     - **Variable name**: `BACKUP_BUCKET`
     - **R2 bucket**: Select `beacon-backups`.

### 2. Auto-Sync from Oracle VM (`scripts/vm-backup-to-r2.sh`)
The included bash script (`scripts/vm-backup-to-r2.sh`):
1. Flushes active world chunks to disk via `screen` or `tmux` (`save-all flush`).
2. Compresses `world/`, `world_nether/`, `world_the_end/`, `server.properties`, and player permissions into `world-latest.tar.gz`.
3. Syncs the snapshot directly to your R2 bucket via `rclone`.

To set up auto-sync on the VM:
```bash
# Install rclone on the Oracle VM
curl https://rclone.org/install.sh | sudo bash

# Configure R2 credentials in rclone (type: s3, provider: Cloudflare)
rclone config

# Run manually or schedule in crontab (e.g. daily at 4 AM)
crontab -e
# Add:
# 0 4 * * * /bin/bash /opt/minecraft/vm-backup-to-r2.sh >> /var/log/mc-backup.log 2>&1
```

---

## Local Development

### 1. Configure Local Variables
Copy `.dev.vars.example` to `.dev.vars` and fill in your OCI credentials and password hash:
```bash
cp .dev.vars.example .dev.vars
```

### 2. Run the Full Stack with Wrangler Pages Dev
Build the frontend and run Wrangler Pages Functions with a local KV namespace:
```bash
npm run build
npx wrangler pages dev dist --kv DASH_KV
```
The application will be available at `http://localhost:8788`.

### 3. Frontend-Only Hot Reloading (Optional)
If modifying UI components with Vite HMR:
```bash
npm run dev
```
(Vite proxies `/api` requests to `http://127.0.0.1:8788`).

---

## Deployment to Cloudflare Pages

### 1. Create Cloudflare KV Namespace
In the Cloudflare Dashboard, go to **Workers & Pages > KV** and create a namespace named `beacon-kv`.

### 2. Deploy to Pages
You can deploy via Git integration or via the Wrangler CLI:

```bash
# Build the production bundle
npm run build

# Deploy via Wrangler
npx wrangler pages deploy dist --project-name beacon
```

### 3. Configure Bindings & Variables
In the Cloudflare Pages project settings:
1. Under **Settings > Functions > KV namespace bindings**, add a binding:
   - **Variable name**: `DASH_KV`
   - **KV namespace**: Select `beacon-kv`.
2. Under **Settings > Environment variables**, add all variables from the [Environment Variables](#environment-variables) table.

---

## Phase 2: Auto-Stop Cron Worker

The auto-stop cron worker shuts down the Oracle Cloud VM automatically if Minecraft has had 0 players for 30 consecutive minutes:

1. Navigate to `/workers/auto-stop`:
   ```bash
   cd workers/auto-stop
   ```
2. Update `wrangler.toml` with your `DASH_KV` namespace ID.
3. Configure the same `OCI_*` environment variables as secrets:
   ```bash
   npx wrangler secret put OCI_TENANCY_OCID
   npx wrangler secret put OCI_USER_OCID
   npx wrangler secret put OCI_FINGERPRINT
   npx wrangler secret put OCI_PRIVATE_KEY_B64
   npx wrangler secret put OCI_INSTANCE_OCID
   npx wrangler secret put OCI_COMPARTMENT_OCID
   ```
4. Deploy the cron worker:
   ```bash
   npx wrangler deploy
   ```
   The worker runs every 10 minutes (`*/10 * * * *`).
