# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files (needed for pnpm workspace resolution)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy only the backend package (prevents full monorepo install)
COPY backend/package.json ./backend/

# Install dependencies (production + dev, needed to compile)
RUN pnpm install --frozen-lockfile --filter @betterroads/backend...

# Copy backend source
COPY backend/ ./backend/

# Build: bundle to a single file so the runtime image needs no node_modules
RUN pnpm --filter @betterroads/backend run build


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# We bundle everything with esbuild, but copy the built file only.
COPY --from=builder /app/backend/dist/index.js ./index.js

# Copy migrations folder for automatic startup migrations
COPY --from=builder /app/backend/migrations ./migrations

# Health endpoint is on /health at the PORT below.
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "index.js"]
