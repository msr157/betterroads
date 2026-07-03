# BetterRoads

> AI-powered road condition monitoring and predictive maintenance for smarter cities.

[![CI](https://gitea.rackops.in/mayank/betterroads/actions/workflows/ci.yml/badge.svg)](https://gitea.rackops.in/mayank/betterroads/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Overview

**BetterRoads** is a production-ready platform for road infrastructure intelligence. It combines IoT sensor data, satellite imagery analysis, and machine learning to predict road degradation before it becomes a costly emergency — reducing maintenance spend by up to 60%.

---
## Roshan Yadav
## Features

| Feature | Description |
|---|---|
| 🤖 AI Condition Mapping | CV + ML classification of road surface conditions |
| ⚡ Predictive Maintenance | Forecast failures weeks in advance |
| 📡 Real-Time Monitoring | Live IoT sensor + crowd-sourced reporting |
| 📊 Analytics Dashboard | KPI tracking and condition trend reports |
| 👥 Citizen Reporting | Mobile portal for public hazard reports |
| 🔧 Work Order Automation | Auto-generate and route repair orders |

---

## Local Development

```bash
git clone https://github.com/mayank/betterroads.git
cd betterroads
python -m http.server 3000 --directory src
# → http://localhost:3000
```

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
├── .github/workflows/mirror.yml
├── .gitea/workflows/ci.yml
├── src/index.html
├── src/style.css
├── src/app.js
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── docs/branch-strategy.md
└── README.md
```

---

## License

[MIT](LICENSE) © 2026 BetterRoads Contributors
