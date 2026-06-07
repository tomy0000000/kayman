# syntax=docker.io/docker/dockerfile:1

###############################################################################
# Build                                                                       #
###############################################################################

FROM debian:13-slim AS build
WORKDIR /app

# Install build dependencies
RUN apt-get update \
    && apt-get -y --no-install-recommends install  \
    sudo curl ca-certificates libpq-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install mise
# https://mise.jdx.dev/mise-cookbook/docker.html#docker-image-with-mise
ENV MISE_DATA_DIR="/mise"
ENV MISE_INSTALL_PATH="/usr/local/bin/mise"
ENV PATH="/mise/shims:$PATH"
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN curl https://mise.run | sh

# Copy config
COPY mise.toml ./
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/

# Install tools
RUN mise trust && mise install

# Install dependencies
RUN pnpm -C ./frontend install --frozen-lockfile --ignore-scripts

# Copy application
COPY . .

# Build OpenAPI client
RUN mise run build:openapi-client

# Build router
RUN mise run build:frontend-router

# Build frontend
RUN mise run build:frontend

###############################################################################
# Runtime Image                                                               #
###############################################################################

FROM python:3.12
WORKDIR /usr/src/kayman
EXPOSE 8000

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependencies
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies
RUN uv sync --locked --no-dev

# Copy backend application
COPY backend/ ./

# Copy frontend application
COPY --from=build /app/frontend/dist ./static

# Run application
ENTRYPOINT ["uv", "run", "uvicorn", "kayman.main:app", "--host", "0.0.0.0", "--port", "8000"]
