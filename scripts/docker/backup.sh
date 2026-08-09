#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.docker}"
BACKUP_ROOT="${BACKUP_ROOT:-${PROJECT_ROOT}/backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DESTINATION="${BACKUP_ROOT}/${TIMESTAMP}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Fichier d'environnement introuvable : ${ENV_FILE}" >&2
  exit 1
fi

mkdir -p "${DESTINATION}"
cd "${PROJECT_ROOT}"

compose=(docker compose --env-file "${ENV_FILE}")

if ! "${compose[@]}" exec -T db sh -ec \
  'pg_dump --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "${DESTINATION}/database.sql"; then
  rm -f "${DESTINATION}/database.sql"
  echo "Échec de la sauvegarde PostgreSQL." >&2
  exit 1
fi

"${compose[@]}" exec -T app \
  tar -C /app/data -czf - uploads archives > "${DESTINATION}/files.tar.gz"

(
  cd "${DESTINATION}"
  sha256sum database.sql files.tar.gz > SHA256SUMS
)

echo "Sauvegarde créée : ${DESTINATION}"

