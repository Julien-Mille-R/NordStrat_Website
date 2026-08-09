#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.docker}"
IMAGE="${1:-}"

if [[ -z "${IMAGE}" ]]; then
  echo "Usage : $0 <image:version>" >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Fichier d'environnement introuvable : ${ENV_FILE}" >&2
  exit 1
fi

cd "${PROJECT_ROOT}"
APP_IMAGE="${IMAGE}" docker compose --env-file "${ENV_FILE}" \
  up -d --no-deps --no-build app

echo "L'application utilise maintenant ${IMAGE}. Contrôlez /health et les logs."

