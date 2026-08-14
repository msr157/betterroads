# BetterRoads

> AI-powered road condition monitoring and predictive maintenance for smarter cities.

[![CI](https://gitea.rackops.in/mayank/betterroads/actions/workflows/ci.yml/badge.svg)](https://gitea.rackops.in/mayank/betterroads/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Overview

**BetterRoads** (v1.2.0) is a production-ready platform for road infrastructure intelligence. It combines mobile telemetry sensing, IoT sensor data, and machine learning to predict road degradation before it becomes a costly emergency. 

BetterRoads features a **fully compliant, open-source mapping stack** (utilizing MapLibre, CartoDB borderless tiles, and official boundary GeoJSONs) ensuring that maps respect regional mapping laws without relying on proprietary or paid APIs.

---

## Features

| Feature | Description |
|---|---|
| 🤖 AI Condition Mapping | CV + ML classification of road surface conditions |
| ⚡ Predictive Maintenance | Forecast failures weeks in advance |
| 📡 Real-Time Monitoring | Live IoT sensor + crowd-sourced telemetry reporting |
| 🗺️ Compliant Mapping | Open-source map stack strictly respecting regional political boundaries |
| 🗣️ Advanced Feedback | Spam-protected, profile-gated citizen feedback with automatic metadata capture |
| 📊 Analytics Dashboard | KPI tracking, live contract analytics, and condition trend reports |
| 🔧 Work Order Automation | Auto-generate and route repair orders |

---

## Local Development

```bash
git clone https://github.com/mayank/betterroads.git
cd betterroads
pnpm install
pnpm --filter @betterroads/backend dev
pnpm --filter website dev
# dashboard and mobile use their own npm installs; see their READMEs
```

The repository contains four deployable packages: `backend`, `website`,
`dashboard`, and the Expo app in `mobile/app`. Identity and migration setup is
documented in `docs/identity-and-admin.md`; signed Android releases use
`npm run build:apk` and are written to `mobile/app/release/`.

Or with Docker:
```bash
docker compose up --build
# → http://localhost
```

---

## Docker

```bash
docker build -t betterroads:latest .
docker run -p 80:80 betterroads:latest
```

Health check: `GET /health` → `{"status":"ok","service":"betterroads"}`

---

## Branch Strategy

| Branch | Purpose | Deploys |
|---|---|---|
| `main` | Production | ✅ Auto via Dokploy |
| `qa` | Staging / testing | CI only |
| `development` | Active development | No auto-deploy |

---

## CI/CD

```
git push → GitHub → mirror.yml → Gitea → ci.yml (self-hosted runner)
  └─ Lint → Tests → Build → Docker → Health Check → Dokploy (main only)
```

**Secrets required:**

GitHub: `GITEA_USER`, `GITEA_TOKEN`
Gitea: `DOKPLOY_WEBHOOK_URL`

---

## Repository Structure

```
betterroads/
├── backend/       Hono API, PostgreSQL schema and migrations
├── dashboard/     authenticated administrator SPA
├── website/       public website and road map
├── mobile/app/    Expo Android/iOS application
├── ai/            Python analysis pipeline and tests
├── scripts/       release build wrappers
└── docs/          deployment, contracts, identity and release guides
```

---

## License

[MIT](LICENSE) © 2026 BetterRoads Contributors
