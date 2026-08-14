# BetterRoads Deployment Knowledge Base

This document is the BetterRoads reference for architecture, deployment, and troubleshooting on the internal Mini PC server.

---

## 🏗️ 1. Architecture Overview

The production pipeline utilizes a modern GitOps approach with Docker Swarm and Cloudflare Tunnels to securely expose internal services without opening ports on the local router.

1. **Source Control (GitHub/Gitea)**: Code is pushed to the `main` branch.
2. **CI/CD (Dokploy)**: 
   - Dokploy catches the automated webhook from GitHub upon any push to `main`.
   - It builds each application from its configured Dockerfile: root for the website, `backend/Dockerfile`, and `dashboard/Dockerfile`.
   - It updates the Docker Swarm service for the application (e.g., `app-override-online-sensor-4hx2u6`).
3. **Internal Routing (Traefik)**:
   - Dokploy includes a built-in Traefik instance.
   - Traefik automatically reads Docker Swarm labels and creates routing rules (e.g., `Host("betterroads.org") -> Port 80`).
4. **External Exposure (Cloudflare Tunnel)**:
   - A `cloudflared` daemon runs on the server.
   - It maintains a secure outbound connection to the Cloudflare Edge.
   - Ingress rules direct traffic from specific public hostnames (e.g., `betterroads.org`) to the internal Traefik instance.
5. **DNS & Edge (Cloudflare)**:
   - The domain's DNS is managed by Cloudflare.
   - `CNAME` records point the domain to the unique Cloudflare Tunnel UUID (e.g., `d1f31e3e-a434-4902-959d-6a2b241f215a.cfargotunnel.com`).
   - The Proxy status (Orange Cloud) must be **ON**.

---

## 🛠️ 2. Known Issues & Troubleshooting Guide

When deploying a new application or changing domains, you may encounter 5XX errors. Here is how to diagnose and fix the 3 most common ones:

### Issue 1: 525 SSL Handshake Failed
* **Symptom**: Cloudflare displays a `525 SSL Handshake Failed` error page.
* **Diagnosis**: Cloudflare is attempting to connect to the origin server using strict SSL, but the origin IP belongs to a domain parking service (like GoDaddy) rather than routing through the Tunnel.
* **Fix**: 
  1. Go to the Cloudflare Dashboard -> DNS -> Records.
  2. Delete any lingering `A` records pointing to old hosting providers or parking IPs.
  3. Ensure there is a `CNAME` record for the root domain and `www` pointing to the `<tunnel-uuid>.cfargotunnel.com`.
  4. Ensure Cloudflare's SSL/TLS encryption mode is set to **Flexible** or **Full** (not "Full (Strict)" unless origin certificates are explicitly configured).

### Issue 2: 502 Bad Gateway (Internal Docker Healthcheck Failure)
* **Symptom**: Cloudflare returns a `502 Bad Gateway` error.
* **Diagnosis**: Traefik cannot route traffic to the container because Docker Swarm has marked the container as "unhealthy". This often happens with Alpine Linux images where `localhost` resolves to IPv6 (`::1`), but the application (e.g., Nginx) only listens on IPv4 (`0.0.0.0:80`).
* **Fix**:
  Modify the `HEALTHCHECK` in the `Dockerfile` to explicitly use the IPv4 loopback address (`127.0.0.1`):
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -fs http://127.0.0.1/health || exit 1
  ```

### Issue 3: 502 Bad Gateway (Tunnel Network Isolation)
* **Symptom**: Cloudflare returns a `502 Bad Gateway` error, even when the Docker container is perfectly healthy.
* **Diagnosis**: The `cloudflared` tunnel container is not connected to the `dokploy-network` and therefore cannot resolve the internal hostname `dokploy-traefik`. It blindly drops the connection.
* **Fix**:
  Instead of routing the Cloudflare Tunnel ingress to the Docker internal DNS name (`http://dokploy-traefik:80`), route it to the Docker bridge gateway IP which corresponds to the host machine's port 80.
  1. Use the Cloudflare API or Dashboard to edit the Tunnel ingress rules.
  2. Change the service URL from `http://dokploy-traefik:80` to `http://172.17.0.1:80` (or the specific local IP like `10.0.1.44:80`).
  3. This allows the tunnel to bypass internal isolated Docker networks and hit Traefik directly via the host's exposed ports.

---

## 📝 3. Deployment Checklist for New Apps

Whenever setting up a new app like `betterroads.org`, ensure the following:
- [ ] **Dokploy Domain Config**: Set `https: false` and `certificateType: none` (Cloudflare handles SSL). Port should match the `EXPOSE` port in the Dockerfile (usually 80).
- [ ] **Dokploy Registry**: assign the `swarm-local` registry (`127.0.0.1:5000`) to the app — without a `registryId` a green deploy silently leaves stale images running on other swarm nodes.
- [ ] **Dockerfile**: Ensure it uses a robust Healthcheck using `127.0.0.1`.
- [ ] **Cloudflare DNS**: Contains ONLY the `CNAME` records pointing to the Tunnel UUID. Delete old `A` records.
- [ ] **Cloudflare Tunnel**: the current tunnel (`564e4c31-a321-4bcb-8f53-6d330ca762c9`, token-managed) needs a public-hostname ingress rule per host; rules point at `http://172.17.0.1:80` because the tunnel cannot resolve the isolated Traefik container network.

---

## 🗺️ 4. Current BetterRoads Deployment Map (as of 2026-08-06)

| Piece | Where |
| --- | --- |
| Frontend (website + public panel) | Dokploy app `9xfHtE9Fq5Hv7Nhwu7o7_` / swarm `app-override-online-sensor-4hx2u6`, root `Dockerfile`, hosts `betterroads.org`, `www` |
| Backend API | Dokploy app `h57LneJzqfvP6KqBUJVvG` / swarm `app-compress-multi-byte-card-7nr73c`, `backend/Dockerfile`, routed as path `/api` on `betterroads.org`, `www`, `betterroads.rackops.in`, and `admin.betterroads.org` |
| Admin dashboard | Dokploy app `GS0TBOtoHCfX-92WgBK4G` / swarm `betterroads-dashboard-pv2edn`, `dashboard/Dockerfile`. Live at both `admin.betterroads.org` and `betterroads.rackops.in`; the Cloudflare DNS CNAME and tunnel route are working as of 2026-08-14. |
| Database | `pg-ha` stack: pg-1 primary + pg-0/pg-2 streaming standbys (re-cloned 2026-08-06 after split-brain); pgpool constrained off `mayank-mainframe-server` (its overlay drops connections — the historic flapping) |
| AI engine | image `betterroads-ai:latest` built on BetterRoad-VM; nightly `run-all` via `/etc/cron.d/betterroads-ai` (02:30) → logs `/var/log/betterroads-ai.log` |
| AI engine | image `betterroads-ai:latest` built on BetterRoad-VM; nightly `run-all` via `/etc/cron.d/betterroads-ai` (02:30) → logs `/var/log/betterroads-ai.log` |
| APK/AAB | Built via `npm run build:apk` (outputs to `mobile/app/release/`). Published manually via GitHub CLI (`gh release create`). |

## 🚀 5. Mobile App Releases

While the backend, admin dashboard, and website automatically deploy via Dokploy webhooks when code is pushed to `main`, the mobile Android app must be published manually to GitHub Releases.

**Release Pipeline:**
1. Generate the signed APK by running `npm run build:apk`.
2. Compute the SHA-256 hash of the generated APK (e.g., via `Get-FileHash` in PowerShell).
3. Draft release notes matching the established style, containing the version, new features, and the SHA-256 hash.
4. Execute the GitHub CLI release command using an authenticated `gh` session:
   ```bash
   gh release create vX.Y.Z "path/to/BetterRoads.apk" --title "BetterRoads vX.Y.Z" --notes-file "path/to/release_notes.md"
   ```
5. The public website automatically links `/downloads/BetterRoads.apk` to the latest GitHub release asset.

## Identity deployment variables

The backend additionally requires `SESSION_SECRET`, `GOOGLE_CLIENT_IDS`
(Android release/debug and Expo Web audiences), and the one-time
`ADMIN_BOOTSTRAP_*` values. Set `CORS_ORIGINS` to all public and administrator
origins. The Expo build embeds `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`,
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, and optionally `EXPO_PUBLIC_API_URL`.

Migrations run before the API starts. A migration or administrator-bootstrap
failure terminates the process so Docker health checking cannot promote a
container with an incompatible schema.
