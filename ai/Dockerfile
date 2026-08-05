# BetterRoads AI Core Engine v1 — batch job image.
#
#   docker build -t betterroads-ai ./ai
#   docker run --rm -e DATABASE_URL=postgresql://... betterroads-ai run-all
#
# Meant to be run on a schedule (cron / Dokploy scheduled job), not as a
# long-lived service: it processes, prints a summary, and exits.

FROM python:3.12-slim

WORKDIR /app

# Install the package (psycopg[binary] wheels — no build toolchain needed).
COPY pyproject.toml README.md ./
COPY betterroads_ai ./betterroads_ai
RUN pip install --no-cache-dir .

# Default command runs both stages; override with classify / rebuild / --dry-run.
ENTRYPOINT ["python", "-m", "betterroads_ai"]
CMD ["run-all"]
