# Hivora Project: one container (API and static UI), linux/amd64 and linux/arm64.

# --- frontend: static export -------------------------------------------------
FROM --platform=$BUILDPLATFORM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS ui
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- backend: locked dependencies in a venv ------------------------------------
FROM python:3.13-alpine@sha256:79e7a9b9ff1cbceff819f856fb374477792a5967759d94df266de7b7b4120e6f AS py
RUN apk add --no-cache binutils
COPY --from=ghcr.io/astral-sh/uv:0.12.18@sha256:3adc3706091ce7c2fe595e669628caedd6d951551b92b258b7e7dbe06d9440bc /uv /bin/uv
ENV UV_PROJECT_ENVIRONMENT=/venv UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /src
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./
RUN uv sync --frozen --no-dev --no-editable \
 && find /venv \( -name tests -o -name __pycache__ \) -type d -prune -exec rm -rf {} + \
 && find /venv -name "*.so" -exec strip --strip-unneeded {} + 2>/dev/null; true

# --- runtime --------------------------------------------------------------------
FROM python:3.13-alpine@sha256:79e7a9b9ff1cbceff819f856fb374477792a5967759d94df266de7b7b4120e6f
COPY --from=py /venv /venv
COPY --from=ui /ui/out /app/frontend
RUN adduser -D -H -u 1000 hivora && install -d -o hivora -g hivora /opt/hivora-project/data
ENV PATH=/venv/bin:$PATH PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER hivora
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8080/api/v1/system/health', timeout=4)"
CMD ["uvicorn", "--factory", "hivora_project.main:create_app", "--host", "0.0.0.0", "--port", "8080"]
