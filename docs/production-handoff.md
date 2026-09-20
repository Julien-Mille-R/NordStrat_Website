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
- Si le rapport mensuel est activé, renseigner les identifiants SMTP Brevo,
  une adresse d'expédition validée, `MONTHLY_REPORT_ENABLED=true` et
  `MONTHLY_REPORT_RECIPIENT=nord.strategie@gmail.com`.
- Envoyer un rapport de test avant l'ouverture avec
  `npm run report:test -- --docker`. Cette commande ne marque pas le mois comme
  déjà envoyé.

## 2. Domaine et Nginx conteneurisé

Node.js écoute uniquement sur le réseau Docker `frontend`. PostgreSQL est isolé
sur le réseau interne `backend`. Nginx est le seul conteneur qui publie des
ports sur le serveur.

1. Faire pointer les enregistrements DNS du domaine vers le serveur.
2. Installer Certbot sur le serveur. Il n'est pas nécessaire d'y installer
   Nginx puisque celui du projet est conteneurisé.
3. Avant le premier démarrage, créer le certificat pendant que le port 80 est
   libre, par exemple avec
   `certbot certonly --standalone -d example.org -d www.example.org`.
4. Renseigner les domaines dans `NGINX_SERVER_NAME`, le nom du dossier de
   certificat dans `NGINX_CERTIFICATE_NAME`, et les chemins Certbot.
5. Définir la même URL HTTPS dans `SITE_URL`.

Nginx redirige HTTP vers HTTPS, limite les requêtes à 6 Mo, sert les ressources
statiques et transmet les autres requêtes à `app:3000`. `TRUST_PROXY=1`
correspond à cette architecture avec un seul proxy.

## 3. PostgreSQL et migrations

Au premier démarrage, PostgreSQL exécute `database/init_db.sql`. Le service
`migrate` applique ensuite, dans l'ordre, les fichiers de
`database/migrations`, puis autorise le démarrage de l'application.

```bash
ENV_FILE=.env.production docker compose --env-file .env.production \
  -f compose.yaml -f compose.production.yaml up -d
ENV_FILE=.env.production docker compose --env-file .env.production \
  -f compose.yaml -f compose.production.yaml ps
curl --fail https://example.org/health
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
