# BetterRoads Deployment Knowledge Base

This document serves as a permanent reference for the architecture, deployment pipeline, and troubleshooting steps for the BetterRoads application (and other similar applications like RogX) running on the internal Mini PC server.

---

## 🏗️ 1. Architecture Overview

The production pipeline utilizes a modern GitOps approach with Docker Swarm and Cloudflare Tunnels to securely expose internal services without opening ports on the local router.

1. **Source Control (GitHub/Gitea)**: Code is pushed to the `main` branch.
2. **CI/CD (Dokploy)**: 
   - Dokploy catches the webhook from GitHub.
   - It builds a Docker image based on the `Dockerfile` in the repository root.
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
- [ ] **Dockerfile**: Ensure it uses a robust Healthcheck using `127.0.0.1`.
- [ ] **Cloudflare DNS**: Contains ONLY the `CNAME` records pointing to the Tunnel UUID. Delete old `A` records.
- [ ] **Cloudflare Tunnel**: Ingress rules point to `http://172.17.0.1:80` for maximum compatibility across isolated Docker networks.
