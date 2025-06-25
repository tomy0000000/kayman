# syntax=docker.io/docker/dockerfile:1

FROM python:3.12
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
COPY . .

# Run application
ENTRYPOINT [ "uvicorn", "kayman.main:app", "--host", "0.0.0.0", "--port", "8000" ]
