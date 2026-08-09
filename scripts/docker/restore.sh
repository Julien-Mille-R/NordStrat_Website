#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.docker}"
BACKUP_DIRECTORY="${1:-}"

if [[ -z "${BACKUP_DIRECTORY}" ]]; then
  echo "Usage : CONFIRM_RESTORE=nordstrat $0 <dossier-de-sauvegarde>" >&2
  exit 1
fi

BACKUP_DIRECTORY="$(cd "${BACKUP_DIRECTORY}" && pwd)"
if [[ "${CONFIRM_RESTORE:-}" != "nordstrat" ]]; then
  echo "Restauration refusée. Définissez CONFIRM_RESTORE=nordstrat pour confirmer." >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Fichier d'environnement introuvable : ${ENV_FILE}" >&2
  exit 1
fi
for required_file in database.sql files.tar.gz SHA256SUMS; do
  if [[ ! -f "${BACKUP_DIRECTORY}/${required_file}" ]]; then
    echo "Sauvegarde incomplète : ${required_file} est absent." >&2
    exit 1
  fi
done

(cd "${BACKUP_DIRECTORY}" && sha256sum --check SHA256SUMS)
cd "${PROJECT_ROOT}"
compose=(docker compose --env-file "${ENV_FILE}")

echo "Création d'une sauvegarde de sécurité avant restauration..."
ENV_FILE="${ENV_FILE}" "${PROJECT_ROOT}/scripts/docker/backup.sh"

"${compose[@]}" stop app
"${compose[@]}" exec -T db sh -ec \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  < "${BACKUP_DIRECTORY}/database.sql"

"${compose[@]}" run --rm --no-deps -T app sh -ec \
  'find /app/data/uploads /app/data/archives -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -C /app/data -xzf -' \
  < "${BACKUP_DIRECTORY}/files.tar.gz"

"${compose[@]}" up -d app
echo "Restauration terminée. Vérifiez ensuite /health et les parcours critiques."
