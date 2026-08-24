# Exécution avec Docker

Cette configuration sépare l'exécution en trois conteneurs permanents : Nginx
(`nginx`), Node.js/Express (`app`) et PostgreSQL (`db`). Le service ponctuel
`migrate` applique les migrations puis `seed` synchronise le catalogue initial
des jeux avant Node.js. Nginx est la seule entrée
publiée ; Node.js et PostgreSQL restent privés sur les réseaux Docker.

Nginx sert directement CSS, JavaScript, images, icônes et uploads. Il transmet
les pages EJS et les actions HTTP à Node.js. Les données PostgreSQL, les
fichiers envoyés et les archives disposent chacun d'un volume persistant.

## Première installation locale

1. Copier `.env.docker.example` vers `.env.docker`.
2. Remplacer les trois secrets. `POSTGRES_PASSWORD` et `DB_PASSWORD` doivent
   contenir exactement la même valeur. Une valeur peut être générée avec
   `openssl rand -hex 32`.
3. Construire et démarrer :

   ```bash
   docker compose --env-file .env.docker up -d --build
   docker compose --env-file .env.docker ps
   curl --fail http://127.0.0.1:8080/health
   ```

Les journaux sont consultables avec :

```bash
docker compose --env-file .env.docker logs -f nginx app db
```

Un arrêt normal conserve toutes les données :

```bash
docker compose --env-file .env.docker down
```

Ne pas ajouter `--volumes` en production : cette option supprime les volumes
et donc les données persistantes du projet.

## Migrations

Chaque évolution de schéma doit être un nouveau fichier SQL numéroté dans
`database/migrations`. Les fichiers déjà appliqués ne doivent jamais être
modifiés. Le service `migrate` les exécute avant le démarrage du site et garde
leur nom ainsi que leur empreinte dans `schema_migration`.

Pour les relancer manuellement :

```bash
docker compose --env-file .env.docker run --rm migrate
```

## Sauvegarde et restauration

Créer une sauvegarde cohérente de PostgreSQL, des téléversements et des
archives :

```bash
./scripts/docker/backup.sh
```

Les sauvegardes sont écrites dans `backups/<date UTC>` et accompagnées de
sommes SHA-256. Elles doivent ensuite être copiées sur un stockage externe au
serveur. Une sauvegarde restée uniquement sur le serveur n'est pas une vraie
protection contre sa perte.

La restauration écrase les données courantes. Elle vérifie d'abord les sommes
de contrôle et produit automatiquement une sauvegarde de sécurité :

```bash
CONFIRM_RESTORE=nordstrat ./scripts/docker/restore.sh backups/<date UTC>
```

## Mise à jour et retour arrière

En production, publier chaque image avec une version immuable, par exemple
`registry.example/nordstrat:2026.08.09-1`, puis définir `APP_IMAGE` dans le
contexte de déploiement. Ne pas réutiliser un même tag pour deux versions.

Après une mise à jour applicative, revenir à une image déjà présente :

```bash
./scripts/docker/rollback.sh registry.example/nordstrat:<ancienne-version>
```

Un retour arrière applicatif ne restaure pas automatiquement la base. Les
migrations doivent donc être rétrocompatibles ; une restauration de base ne
doit être utilisée qu'après analyse et avec une sauvegarde validée.

## Production

- définir `NODE_ENV=production`, l'URL HTTPS réelle dans `SITE_URL` et la bonne
  valeur de `TRUST_PROXY` selon le reverse proxy ;
- ne jamais versionner `.env.docker` ni les sauvegardes ;
- exposer uniquement Nginx ; les services `app` et `db` n'ont aucun port hôte ;
- sauvegarder les trois volumes et tester périodiquement une restauration ;
- conserver au moins l'image en cours et l'image précédente pour le rollback.

La procédure de remise à l'hébergeur, le modèle Nginx et le contrôle des
secrets sont détaillés dans `docs/production-handoff.md`.

La variante HTTPS conteneurisée se lance avec les deux fichiers Compose :

```bash
ENV_FILE=.env.production docker compose --env-file .env.production \
  -f compose.yaml -f compose.production.yaml up -d
```

Elle suppose que Certbot a déjà créé le certificat dans
`LETSENCRYPT_DIRECTORY`. Nginx publie alors HTTP pour la redirection et HTTPS
pour le site.

## Premier administrateur

Sur une base neuve, créer localement un fichier contenant uniquement un mot de
passe initial robuste, le protéger avec `chmod 600`, puis le monter en lecture
seule pour la commande ponctuelle :

```bash
docker compose --env-file .env.production run --rm --no-deps \
  -v /chemin/absolu/admin-password:/run/secrets/admin-password:ro \
  app npm run admin:create -- \
  --firstname "Prénom" --lastname "Nom" --nickname "Pseudo" \
  --email "adresse@example.org" \
  --password-file /run/secrets/admin-password
```

La commande refuse de fonctionner si un administrateur existe déjà. Supprimer
immédiatement le fichier de mot de passe après la première connexion réussie.

## Import initial des fichiers publics

Pour copier les avatars et images administratives présents dans
`public/uploads` vers le volume Docker, sans importer la base locale :

```bash
npm run docker:import-files
```

Les futurs fichiers seront directement écrits dans le volume persistant et
seront inclus par `npm run docker:backup`.
