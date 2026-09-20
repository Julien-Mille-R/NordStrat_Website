#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIRECTORY"

MODE="local"
ENVIRONMENT_FILE=".env"
ASSUME_YES="false"

for argument in "$@"; do
  case "$argument" in
    --docker)
      MODE="docker"
      ENVIRONMENT_FILE=".env.docker"
      ;;
    --yes)
      ASSUME_YES="true"
      ;;
    --help)
      printf '%s\n' \
        'Usage : npm run report:test -- [--docker] [--yes]' \
        '' \
        '  --docker  utilise .env.docker et le conteneur Node.js' \
        '  --yes     confirme l’envoi sans poser de question'
      exit 0
      ;;
    *)
      printf 'Option inconnue : %s\n' "$argument" >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "$ENVIRONMENT_FILE" ]]; then
  printf 'Fichier de configuration introuvable : %s\n' "$ENVIRONMENT_FILE" >&2
  exit 1
fi

if [[ "$ASSUME_YES" != "true" ]]; then
  if [[ ! -t 0 ]]; then
    printf 'Confirmation interactive impossible. Relancez avec --yes.\n' >&2
    exit 1
  fi
  printf 'Cette commande va envoyer un vrai mail via Brevo. Continuer ? [y/N] '
  read -r confirmation
  case "$confirmation" in
    y|Y|yes|YES|oui|OUI) ;;
    *)
      printf 'Envoi annulé.\n'
      exit 0
      ;;
  esac
fi

if [[ "$MODE" == "docker" ]]; then
  env ENV_FILE="$ENVIRONMENT_FILE" docker compose --env-file "$ENVIRONMENT_FILE" \
    run --rm --build app node scripts/send-monthly-report-test.js
else
  node --env-file="$ENVIRONMENT_FILE" scripts/send-monthly-report-test.js
fi
