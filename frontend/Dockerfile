# syntax=docker.io/docker/dockerfile:1

###############################################################################
# OpenAPI Spec                                                                #
###############################################################################

FROM python:3.12 AS spec
WORKDIR /usr/src/kayman
EXPOSE 8000

# Install pip & poetry
RUN pip install --no-cache-dir --upgrade pip==25 poetry==2

# Copy dependencies
COPY backend/pyproject.toml backend/poetry.lock ./

# Install dependencies
RUN poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi

# Copy application
COPY backend/ .

RUN scripts/generate_openapi.sh openapi.json

###############################################################################
# Dependencies                                                                #
###############################################################################

FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# https://github.com/nodejs/docker-node/tree/b5d21345ca11f46cf93be68923696979aafc0326?tab=readme-ov-file#nodealpine
RUN apk add --no-cache gcompat=1.1.0-r4

# Copy dependencies
COPY frontend/openapi-ts.config.ts frontend/package.json frontend/pnpm-lock.yaml ./
COPY frontend/scripts ./scripts

# Copy Openapi.json
COPY --from=spec /usr/src/kayman/openapi.json /tmp/openapi.json

# Install dependencies
RUN corepack enable pnpm && pnpm install --frozen-lockfile

###############################################################################
# Build                                                                       #
###############################################################################

FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application
COPY frontend/ .

# Copy Openapi.json
COPY --from=spec /usr/src/kayman/openapi.json /tmp/openapi.json

# Build Client
RUN corepack enable pnpm && pnpm run generate-client

# Build application
RUN corepack enable pnpm && pnpm run build

###############################################################################
# Production Image                                                            #
###############################################################################

FROM base AS runner
WORKDIR /app
EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Copy application
# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Setup user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs \
    && chown -R nextjs:nodejs /app
USER nextjs

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
CMD ["node", "server.js"]
