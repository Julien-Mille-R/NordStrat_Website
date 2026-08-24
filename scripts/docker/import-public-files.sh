#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.docker}"
SOURCE_DIRECTORY="${SOURCE_DIRECTORY:-${PROJECT_ROOT}/public/uploads}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Fichier d'environnement introuvable : ${ENV_FILE}" >&2
  exit 1
fi
if [[ ! -d "${SOURCE_DIRECTORY}" ]]; then
  echo "Dossier d'uploads introuvable : ${SOURCE_DIRECTORY}" >&2
  exit 1
fi

cd "${PROJECT_ROOT}"
docker compose --env-file "${ENV_FILE}" cp "${SOURCE_DIRECTORY}/." app:/app/data/uploads
docker compose --env-file "${ENV_FILE}" exec -T app sh -ec \
  'find /app/data/uploads -type d -exec chmod 755 {} +; find /app/data/uploads -type f -exec chmod 644 {} +'
echo "Fichiers publics copiés dans le volume Docker uploads_data."
