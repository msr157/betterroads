# Branch Strategy

## Branches

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | Production-ready code | Production (Dokploy) |
| `qa` | QA / acceptance testing | Staging (CI only) |
| `development` | Active feature work | Dev only |

## Flow

```
development → PR → qa → PR + approval → main → Auto Deploy
```

CI runs on `qa` and `main`. Dokploy deployment only on `main`.
