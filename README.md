# Beacon

A small, private control panel for a friends-only Minecraft server running on an Oracle Cloud VM.
Anyone with the shared password can see whether the server is up, copy the join address, start or
stop the VM, and download the world save. It runs entirely on Cloudflare's free tier.

![Beacon dashboard on desktop](docs/dashboard.jpg)

<img src="docs/dashboard-phone.jpg" alt="Beacon on a phone while the server is starting" width="300">

## What it does

- **Status at a glance.** One answer to "can we play right now?": the server state, the join address
  with a copy button, and a four-step boot track (Off → VM booting → Loading world → Online), since
  Minecraft needs a minute or two after the VM is up.
- **Start, stop, restart** the Oracle VM. A 30-second cooldown stops double clicks, and stopping or
  restarting while people are online asks you to type `STOP` / `RESTART` first.
- **Players online**, from the public [mcsrvstat.us](https://mcsrvstat.us) API.
- **World save download** (`.tar.gz`) from Cloudflare R2, Oracle Object Storage, or straight from the
  VM. It works while the VM is off when the save lives in a bucket. See [World saves](#world-saves).
- **Oracle cost and trial tracking**: the VM's size, an estimated hourly cost, days left on the trial,
  and whether the VM would fit Oracle's Always Free Ampere allowance.
- **Activity log** of starts, stops, sign-ins and downloads (last 100 kept, IPs stored as a short hash).
- **Auto-stop** (optional worker): shuts the VM down after 30 minutes with nobody online.

## How it fits together

```
 Browser ──HTTPS──▶ Cloudflare Worker (static React app + Functions in functions/)
                        │  KV: sessions, rate limits, cooldown, activity log, caches
                        ├──▶ Oracle Cloud API (signed requests): VM state, power, public IP
                        ├──▶ mcsrvstat.us: Minecraft status and players
                        └──▶ R2 bucket / Object Storage link: world-latest.tar.gz

 Oracle VM ── scripts/backup-world.sh ──▶ R2 / Object Storage / local folder for serve-backup.sh
```

- **Frontend:** React 18, Vite, Tailwind CSS, self-hosted Public Sans. No third-party scripts, fonts
  or CDNs.
- **Backend:** Cloudflare Pages Functions (`functions/`), compiled into a Worker by `npm run build`
  and deployed with `wrangler.jsonc`. Web Crypto only: no Node APIs, no crypto packages.
- **Storage:** one KV namespace bound as `DASH_KV`; optionally an R2 bucket bound as `BACKUP_BUCKET`.

## Quick start

You need Node 20+, a Cloudflare account and an Oracle Cloud VM running your Minecraft server.

```bash
npm install
cp .dev.vars.example .dev.vars        # then fill it in (see Configuration)
npm run hash-password "your-password" # paste the output into PASSWORD_HASH
npm run build
npx wrangler pages dev dist --kv DASH_KV
```

Open <http://localhost:8788> and sign in.

## Configuration

Set these in `.dev.vars` for local development, and as variables/secrets on the deployed Worker
(**Settings → Variables and Secrets** in the Cloudflare dashboard, or `npx wrangler secret put NAME`).

| Variable | Required | What it is |
|---|---|---|
| `OCI_TENANCY_OCID` | yes | Your Oracle Cloud tenancy OCID |
| `OCI_USER_OCID` | yes | The API user's OCID |
| `OCI_FINGERPRINT` | yes | Fingerprint of the API key you uploaded |
| `OCI_PRIVATE_KEY_B64` | yes | The PKCS#8 private key, base64-encoded (see [OCI API key](#oci-api-key)) |
| `OCI_REGION` | yes | Region of the VM, e.g. `me-dubai-1` |
| `OCI_INSTANCE_OCID` | yes | The Minecraft VM's OCID |
| `OCI_COMPARTMENT_OCID` | yes | Compartment holding the VM (used to find its public IP) |
| `PASSWORD_HASH` | yes | Output of `npm run hash-password` |
| `SESSION_SECRET` | yes | Random string of 32+ characters for signing session cookies |
| `TRIAL_END` | no | When the Oracle trial ends, ISO 8601 (`2026-12-01T00:00:00Z`). Leave out to hide the countdown |
| `BACKUP_URL` | no | Oracle Object Storage pre-authenticated request (or any HTTPS link) to the world save |
| `VM_BACKUP_TOKEN` | no | Secret path segment for the direct-from-VM download |
| `TURNSTILE_SITEKEY` / `TURNSTILE_SECRET` | no | Cloudflare Turnstile bot check on the sign-in screen (set both) |

| Binding | Required | What it is |
|---|---|---|
| `DASH_KV` | yes | KV namespace (already in `wrangler.jsonc`) |
| `BACKUP_BUCKET` | no | R2 bucket holding `world-latest.tar.gz` |

### Password hash

Beacon stores only a PBKDF2-SHA256 hash (100,000 iterations, random 16-byte salt):

```bash
npm run hash-password "your-strong-password"
# pbkdf2$100000$<salt>$<hash>
```

### OCI API key

Oracle signs API requests with an RSA key, and Web Crypto needs it in PKCS#8 form.

```bash
openssl genrsa -out oci_api_key.pem 2048
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in oci_api_key.pem -out oci_api_key_pkcs8.pem
openssl rsa -pubout -in oci_api_key.pem -out oci_api_key_public.pem
```

1. In the Oracle Cloud console, open **Profile → User settings → API keys → Add API key** and upload
   `oci_api_key_public.pem`. Note the fingerprint, user OCID and tenancy OCID it shows.
2. Base64-encode the PKCS#8 key into one line for `OCI_PRIVATE_KEY_B64`:

   ```bash
   base64 -w 0 oci_api_key_pkcs8.pem                                                  # Linux
   base64 -i oci_api_key_pkcs8.pem | tr -d '\n'                                       # macOS
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("oci_api_key_pkcs8.pem"))        # PowerShell
   ```

The API user needs permission to read and power the instance and to read its VNIC, for example:

```
Allow group beacon to use instance-family in compartment <name>
Allow group beacon to read virtual-network-family in compartment <name>
```

## World saves

The **Download .tar.gz** button gives you `world-latest.tar.gz`: the world folder (with its nether and
end folders on Paper/Spigot), `server.properties`, `whitelist.json`, `ops.json`, the ban lists and
`usercache.json`. Beacon looks for it in this order and uses the first that is configured:

| Source | Set up with | Works while the VM is off | How the download travels |
|---|---|---|---|
| **Cloudflare R2** (recommended) | `BACKUP_BUCKET` binding | yes | Streamed by Beacon over HTTPS, behind the sign-in |
| **Oracle Object Storage** | `BACKUP_URL` | yes | Redirect to the pre-authenticated HTTPS link |
| **Direct from the VM** | nothing (fallback) | no | Redirect to `http://<vm-ip>:8080/...` while `serve-backup.sh` runs |

The dashboard shows which source is in use, the archive's size and when it was saved. It only enables
the button when Beacon can see the file (the VM fallback cannot be checked from Cloudflare; see below).

### 1. Pack and upload from the VM

Copy `scripts/backup-world.sh` (and `serve-backup.sh` if you want the fallback) to the VM, then:

```bash
MC_DIR=/opt/minecraft bash backup-world.sh
```

The script:

1. Runs `save-off` and `save-all flush` in the `minecraft` screen or tmux session (if there is one),
   so the archive is consistent, and turns autosave back on afterwards, even if something fails.
2. Reads `level-name` from `server.properties`, packs whatever of the files above exist, skips logs
   and `session.lock`, and checks the archive with `gzip -t`.
3. Uploads it to every destination that is configured: an rclone remote named `r2`, the `UPLOAD_URL`
   link, and the local folder `serve-backup.sh` publishes.
4. Keeps dated copies in `OUT_DIR` for `KEEP_DAYS` days.

| Setting | Default | |
|---|---|---|
| `MC_DIR` | `/opt/minecraft` | Server folder |
| `MC_SESSION` | `minecraft` | screen/tmux session running the server |
| `OUT_DIR` | `/var/backups/minecraft` | Where archives are kept (must be writable) |
| `KEEP_DAYS` | `3` | Delete dated archives older than this |
| `R2_REMOTE` / `R2_BUCKET` | `r2` / `beacon-backups` | rclone remote and bucket |
| `UPLOAD_URL` | none | Object Storage pre-authenticated link with write access |
| `SERVE_DIR` | `$MC_DIR/.beacon-serve` | Folder `serve-backup.sh` publishes |
| `VM_BACKUP_TOKEN` | none | Secret folder name inside `SERVE_DIR` |

Run it on a schedule with cron. Remember the auto-stop worker turns the VM off when it is idle, so
pick a time when it is usually running, or run it by hand after a session:

```cron
0 4 * * * MC_DIR=/opt/minecraft bash /opt/beacon/backup-world.sh >> /var/log/mc-backup.log 2>&1
```

`scripts/vm-backup-to-r2.sh` still works as a name for existing crontabs; it runs `backup-world.sh`.

### 2a. Cloudflare R2 (recommended)

R2 has a free allowance of 10 GB with no egress fees, and the download stays behind Beacon's sign-in.

1. Create the bucket: `npx wrangler r2 bucket create beacon-backups`.
2. Bind it to Beacon: uncomment the `r2_buckets` block in `wrangler.jsonc` and deploy.
3. In **R2 → Manage API tokens**, create a token with *Object Read & Write* on that bucket.
4. On the VM, install rclone and add the remote:

   ```bash
   curl https://rclone.org/install.sh | sudo bash
   rclone config create r2 s3 provider=Cloudflare \
     access_key_id=<key-id> secret_access_key=<secret> \
     endpoint=https://<account-id>.r2.cloudflarestorage.com acl=private
   ```

5. Run `backup-world.sh`. The dashboard shows the save within seconds.

### 2b. Oracle Object Storage

1. Create a private bucket in the same region as the VM.
2. On the bucket, create a **pre-authenticated request** for the whole bucket. Give it a long expiry.
   Copy the URL; it ends in `/o/`.
3. Set that URL as `BACKUP_URL` in Beacon (Beacon appends `world-latest.tar.gz`), and as `UPLOAD_URL`
   on the VM. A link that permits reads and writes works for both; for tighter access, give Beacon a
   read-only link and the VM a write-only one.

Beacon checks the link with a `HEAD` request (falling back to a 1-byte ranged `GET`) and caches the
answer for a minute, so a fresh upload can take up to a minute to appear.

### 2c. Direct from the VM (fallback)

With no bucket configured, Beacon can send you straight to the VM while it is running:

```bash
VM_BACKUP_TOKEN=<random-string> bash serve-backup.sh
```

This packs a fresh archive and serves **only** that folder on port 8080, never the server folder (it
holds the RCON password). For it to work:

- add an ingress rule for TCP 8080 to the VM's security list in the Oracle console;
- open the host firewall too on Oracle's Ubuntu images: `sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT`;
- set the same `VM_BACKUP_TOKEN` in Beacon, so the link cannot be guessed.

Limits: Cloudflare cannot reach a bare IP, so Beacon cannot tell whether `serve-backup.sh` is
running; the download is plain HTTP, so browsers ask before keeping it; and it opens in a new tab so
a failure does not replace the dashboard. Use R2 or Object Storage when you can.

### 3. Restore on a new server

```bash
tar -xzf minecraft-world-*.tar.gz -C /opt/minecraft
```

Then start the server as usual. Moving to an Always Free Ampere (ARM) VM works the same way: world
files are not tied to the CPU.

## Local development

```bash
npm run build
npx wrangler pages dev dist --kv DASH_KV                                   # http://localhost:8788
npx wrangler pages dev dist --kv DASH_KV --r2 BACKUP_BUCKET=beacon-backups # with a local R2 bucket
```

To put a test archive in the local bucket:

```bash
npx wrangler r2 object put beacon-backups/world-latest.tar.gz --file ./world-latest.tar.gz --local
```

For hot reload of the UI, keep `wrangler pages dev` running and start Vite alongside it with
`npm run dev`; Vite proxies `/api` to port 8788.

## Deployment

`wrangler.jsonc` deploys Beacon as a Worker that serves the built app from `dist/` and runs the
Functions compiled by `npm run build`:

```bash
npm run build
npx wrangler deploy
```

Add the variables from [Configuration](#configuration) under **Settings → Variables and Secrets**
(the private key, password hash and session secret as secrets). `keep_vars` in `wrangler.jsonc` keeps
dashboard variables across deploys. The KV namespace is already bound; R2 is bound by the commented
block in `wrangler.jsonc`.

### Auto-stop worker

`workers/auto-stop` checks every 10 minutes and sends a graceful stop once the server has had nobody
online for `AUTO_STOP_MINUTES` (default 30). It shares the dashboard's KV namespace, so its stops
appear in the activity log.

```bash
cd workers/auto-stop
npx wrangler secret put OCI_TENANCY_OCID     # and OCI_USER_OCID, OCI_FINGERPRINT,
                                             # OCI_PRIVATE_KEY_B64, OCI_INSTANCE_OCID, OCI_COMPARTMENT_OCID
npx wrangler deploy
```

Set `OCI_REGION` and `AUTO_STOP_MINUTES` in `workers/auto-stop/wrangler.toml`.

## Security

- **One shared password**, stored as a PBKDF2-SHA256 hash and checked in constant time.
- **Sessions** are HMAC-signed `__Host-` cookies: `HttpOnly`, `Secure`, `SameSite=Strict`, 8 hours.
- **Brute force:** 5 wrong passwords lock that IP for 15 minutes; 25 across all IPs lock sign-in for
  everyone for 15 minutes. Each failure waits 800 ms. Optional Turnstile on top.
- **CSRF:** every `POST` must come from the same origin with an `X-Requested-With` header and a JSON
  body under 1 KB.
- **Strict CSP:** scripts, styles, fonts and connections from the app's own origin only (plus
  Cloudflare's challenge domain when Turnstile is on).
- **Power actions** are re-checked on the server: valid state, cooldown, and players online.
- **World saves** from R2 are only served to signed-in users. Object Storage and VM links are secrets:
  anyone who has the full URL can download the save.

## API

| Route | Auth | |
|---|---|---|
| `POST /api/login` | public | `{ password, turnstileToken? }` → sets the session cookie |
| `GET /api/config` | public | `{ turnstileSiteKey }` for the sign-in screen |
| `GET /api/session` | session | 200 if the cookie is valid, 401 if not |
| `GET /api/status` | session | VM and Minecraft state, players, address, usage, trial, world save, activity |
| `POST /api/power` | session | `{ action: "start" \| "stop" \| "restart", force? }`; 409 with `playerCount` if people are online |
| `GET /api/backup` | session | Where the world save is and whether it can be downloaded |
| `GET /api/backup?download=1` | session | The download (stream from R2, or a redirect) |
| `POST /api/logout` | session | Clears the cookie |

## Project layout

```
functions/            Cloudflare Functions (API + middleware)
  _lib/               auth, OCI request signing, Minecraft status, rate limits, activity log, backups
  api/                one file per route
src/                  React app
  components/         screens and panels
  serverState.ts      VM + Minecraft state → what the screen says
scripts/              hash-password, backup-world.sh, serve-backup.sh
workers/auto-stop/    idle shutdown cron worker
public/               fonts (Public Sans, OFL), favicon, security headers
```

## Troubleshooting

- **State shows "Unknown"**: Beacon could not read the VM from Oracle. Check the `OCI_*` values,
  that the key is PKCS#8, and the API user's permissions.
- **Stuck on "Loading world"**: the VM is up but mcsrvstat.us cannot reach Minecraft. Check that the
  server is running and TCP 25565 is open in the security list and the host firewall.
- **The download button is off**: read the line under it. "Waiting for upload" means the bucket is
  connected but `backup-world.sh` has not uploaded yet; "Not set up" means no source is configured
  and the VM is off.
- **The VM download fails or never finishes**: `serve-backup.sh` is not running, or port 8080 is
  closed in the security list or by iptables.
- **Signed out after deploying**: changing `SESSION_SECRET` invalidates existing sessions.
