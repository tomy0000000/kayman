#!/usr/bin/env bash
set -euo pipefail
#MISE description="Setup environment variables"

ENV_FILE="instance/.env"
if [ -f "$ENV_FILE" ]; then
    echo "$ENV_FILE already exists, skipping"
    exit 0
fi

mkdir -p "$(dirname "$ENV_FILE")"
cat > "$ENV_FILE" <<EOF
ENVIRONMENT=local
SECRET_KEY=$(openssl rand -base64 32)
POSTGRES_USER=kayman
POSTGRES_PASSWORD=$(openssl rand -base64 24)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=kayman
EOF
echo "Created $ENV_FILE"
