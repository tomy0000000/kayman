# syntax=docker.io/docker/dockerfile:1

FROM python:3.12
WORKDIR /usr/src/kayman
EXPOSE 8000

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependencies
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies
RUN uv sync --locked

# Copy application
COPY backend .

# Run application
ENTRYPOINT [ "uv", "run", "uvicorn", "kayman.main:app", "--host", "0.0.0.0", "--port", "8000" ]
