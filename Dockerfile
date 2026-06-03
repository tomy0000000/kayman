# syntax=docker.io/docker/dockerfile:1

###############################################################################
# Backend Base                                                                #
###############################################################################

FROM python:3.12 AS backend-base

###############################################################################
# OpenAPI Spec                                                                #
###############################################################################

FROM backend-base AS backend-build
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependencies
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies
RUN uv sync --locked

# Copy application
COPY backend/ ./

# Generate OpenAPI spec
RUN POSTGRES_PASSWORD=dummy uv run python -m kayman.openapi /tmp/openapi.json

###############################################################################
# Frontend Base                                                               #
###############################################################################

FROM node:22-alpine AS frontend-base
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

###############################################################################
# Frontend Dependencies                                                       #
###############################################################################

FROM frontend-base AS frontend-deps
WORKDIR /app

# # https://github.com/nodejs/docker-node/tree/b5d21345ca11f46cf93be68923696979aafc0326?tab=readme-ov-file#nodealpine
# RUN apk add --no-cache gcompat=1.1.0-r4

# Copy necessary configs and scripts
COPY frontend/openapi-ts.config.ts frontend/package.json frontend/pnpm-lock.yaml ./
COPY frontend/scripts ./scripts

# Copy OpenAPI spec
COPY --from=backend-build /tmp/openapi.json /tmp/openapi.json

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

###############################################################################
# Frontend Build                                                              #
###############################################################################

FROM frontend-base AS frontend-build
WORKDIR /app

# Copy OpenAPI spec, dependencies, and application
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY --from=backend-build /tmp/openapi.json /tmp/openapi.json
COPY frontend/ ./

# Build API client
RUN pnpm run generate-client

# Build router
RUN pnpm run generate-router

# Build frontend
RUN pnpm run build

###############################################################################
# Runtime Image                                                               #
###############################################################################

FROM backend-base
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
COPY --from=frontend-build /app/dist ./static

# Run application
ENTRYPOINT ["uv", "run", "uvicorn", "kayman.main:app", "--host", "0.0.0.0", "--port", "8000"]
