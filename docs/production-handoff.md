# Préparation de la production

Ce document couvre la remise à l'hébergeur jusqu'à l'initialisation de la base.
La création du premier administrateur sera documentée séparément.

## 1. Secrets et fichiers privés

- Aucun fichier `.env` réel, certificat, sauvegarde ou upload ne doit entrer
  dans Git.
- Copier `.env.production.example` vers `.env.production`, renseigner les
  valeurs réelles, puis appliquer `chmod 600 .env.production`.
- Contrôler le fichier sans afficher ses secrets :

  ```bash
  npm run production:check
  ```

- Les secrets de production ne doivent pas être repris depuis le poste de
  développement et doivent être transmis par un canal séparé du dépôt Git.

## 2. Domaine et Nginx

L'application Docker écoute uniquement sur `127.0.0.1:3000`. PostgreSQL n'a
aucun port publié. Nginx est donc la seule entrée publique.

1. Faire pointer les enregistrements DNS du domaine vers le serveur.
2. Installer Nginx et Certbot sur le serveur.
3. Copier d'abord `deploy/nginx/nordstrat-http.conf.example` dans
   `/etc/nginx/sites-available/nordstrat`, remplacer `example.org`, activer le
   site et vérifier avec `nginx -t`.
4. Créer le certificat, par exemple avec
   `certbot certonly --webroot -w /var/www/html -d example.org -d www.example.org`.
5. Remplacer la configuration temporaire par
   `deploy/nginx/nordstrat.conf.example`, adapter le domaine, vérifier avec
   `nginx -t`, puis recharger Nginx.
6. Définir la même URL HTTPS dans `SITE_URL`.

Nginx redirige HTTP vers HTTPS, limite les requêtes à 6 Mo et transmet les
en-têtes attendus par Express. `TRUST_PROXY=1` ne convient que lorsque Nginx
est l'unique proxy devant l'application.

## 3. PostgreSQL et migrations

Au premier démarrage, PostgreSQL exécute `database/init_db.sql`. Le service
`migrate` applique ensuite, dans l'ordre, les fichiers de
`database/migrations`, puis autorise le démarrage de l'application.

```bash
ENV_FILE=.env.production docker compose --env-file .env.production up -d
ENV_FILE=.env.production docker compose --env-file .env.production ps
curl --fail http://127.0.0.1:3000/health
```

Pour chaque changement futur du schéma : créer un nouveau fichier SQL daté,
ne jamais modifier une migration déjà appliquée, sauvegarder avant le
déploiement et vérifier les journaux du service `migrate`.

```bash
ENV_FILE=.env.production docker compose --env-file .env.production logs migrate
```

Les volumes `postgres_data`, `uploads_data` et `archives_data` sont
persistants. Un `docker compose down` les conserve ; ne jamais employer
`down --volumes` sur le serveur de production.
