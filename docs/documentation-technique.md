# Documentation technique de Nord Stratégie

## 1. Objet du document

Ce document décrit le fonctionnement technique du site Nord Stratégie.

Il s'adresse à trois publics :

- la personne qui développe le site ;
- la personne qui assure son hébergement ;
- la personne qui reprendra sa maintenance plus tard.

Le langage reste volontairement simple. Les chemins et noms techniques sont
ceux du projet.

## 2. Présentation générale

### 2.1 Objectif du site

Le site présente l'association Nord Stratégie et ses activités.

Il fournit aussi des outils pratiques :

- création de comptes membres ;
- profils publics ;
- réservation de tables de jeux ;
- discussions autour des tables ;
- publication d'actualités ;
- suivi des cotisations ;
- gestion des membres ;
- messages de contact ;
- inscriptions à l'Assaut de Bruay ;
- archivage et statistiques des soirées ;
- journal des actions administratives.

### 2.2 Types d'utilisateurs

Le projet utilise deux rôles :

- `User` : membre inscrit ;
- `Admin` : administrateur du site.

Un visiteur non connecté peut consulter les pages publiques, les actualités et
le formulaire de contact.

Un membre connecté peut gérer son compte, son profil et ses réservations.

Un administrateur accède aux outils placés sous `/admindashboard`.

### 2.3 Style d'application

Le projet suit une architecture MVC classique :

- les modèles représentent les données ;
- les contrôleurs portent les règles métier ;
- les vues EJS produisent le HTML ;
- le routeur relie une URL à un contrôleur.

Le site n'utilise pas React ni de framework frontend monopage.

## 3. Architecture technique

### 3.1 Vue générale

```text
Navigateur
   │
   ▼
Nginx
   ├── CSS, JavaScript, images, icônes et uploads
   │
   └── requêtes dynamiques
           │
           ▼
      Node.js / Express
           │
           ▼
       PostgreSQL
```

Nginx est la seule porte d'entrée publiée par Docker.

Node.js écoute sur le port interne `3000`. Ce port n'est pas publié sur la
machine hôte.

PostgreSQL écoute sur le port interne `5432`. Ce port n'est pas publié par
Docker.

### 3.2 Réseaux Docker

Deux réseaux séparent les responsabilités :

- `frontend` relie Nginx à Node.js ;
- `backend` relie Node.js, les migrations, le seed et PostgreSQL.

Le réseau `backend` est déclaré `internal`. Nginx ne peut pas joindre la base.

### 3.3 Services Docker

Le fichier principal est `compose.yaml`.

Il définit :

- `nginx` : entrée HTTP et serveur de fichiers statiques ;
- `app` : application Express et vues EJS ;
- `db` : base PostgreSQL 17 ;
- `migrate` : application ponctuelle des migrations ;
- `seed` : synchronisation ponctuelle du catalogue initial de jeux.

Les trois premiers sont permanents. `migrate` et `seed` s'arrêtent avec le code
de sortie `0` après leur travail.

L'ordre de démarrage est le suivant :

```text
PostgreSQL sain
   → migrations terminées
   → seed des jeux terminé
   → Node.js sain
   → Nginx sain
```

### 3.4 Volumes persistants

Trois volumes conservent les données :

- `postgres_data` : données PostgreSQL ;
- `uploads_data` : avatars et images envoyées ;
- `archives_data` : exports JSON des soirées.

Un redémarrage ou un `docker compose down` conserve ces volumes.

La commande `docker compose down --volumes` les supprime. Elle ne doit pas être
utilisée en production.

### 3.5 Structure des dossiers

```text
controller/       contrôleurs Express
database/         schéma initial, migrations et seeds
deploy/nginx/     image et configuration Nginx
docs/             documentation
models/           modèles Sequelize et relations
public/           CSS, JavaScript navigateur, images et icônes
router/           déclaration des routes
scripts/          migrations, seed, administration et exploitation
services/         services métier partagés
tests/            tests unitaires, smoke tests et intégration
views/            vues EJS et partials
```

### 3.6 Cycle d'une requête dynamique

Exemple pour `/booking` :

1. Le navigateur envoie la requête à Nginx.
2. Nginx transmet la requête à `app:3000`.
3. Express applique les middlewares de sécurité et de session.
4. Le routeur appelle `showBookingPage`.
5. Le contrôleur interroge les modèles Sequelize.
6. Sequelize interroge PostgreSQL.
7. Le contrôleur transmet les données à `booking.ejs`.
8. EJS génère le HTML.
9. Nginx renvoie la réponse au navigateur.

## 4. Technologies utilisées

### 4.1 Backend

- Node.js 24 ;
- Express 5 ;
- EJS pour les vues ;
- Sequelize 6 pour les modèles ;
- `pg` pour PostgreSQL ;
- `express-session` pour les sessions ;
- `connect-pg-simple` pour stocker les sessions dans PostgreSQL ;
- bcrypt pour les mots de passe.

### 4.2 Frontend

- HTML généré par EJS ;
- Tailwind CSS ;
- JavaScript natif côté navigateur ;
- mise en page responsive ;
- aucune dépendance à React.

### 4.3 Sécurité et fichiers

- Helmet pour les en-têtes HTTP ;
- Multer pour la réception des images ;
- `express-rate-limit` avec stockage PostgreSQL ;
- jetons CSRF stockés en session ;
- contrôle de l'origine des requêtes sensibles.

### 4.4 Infrastructure

- Docker ;
- Docker Compose ;
- Nginx 1.28 ;
- PostgreSQL 17 ;
- Certbot et Let's Encrypt prévus pour HTTPS.

## 5. Initialisation du projet

### 5.1 Prérequis

Pour un lancement classique :

- Node.js 24 ;
- npm ;
- PostgreSQL ;
- un fichier `.env` valide.

Pour un lancement conteneurisé :

- Docker ;
- Docker Compose ;
- un fichier `.env.docker` valide.

### 5.2 Installation locale sans Docker

```bash
npm ci
npm run build:css
npm run dev
```

Le site répond alors sur `http://localhost:3000`.

Le fichier `.env.example` documente les variables attendues.

### 5.3 Installation locale avec Docker

Copier le modèle :

```bash
cp .env.docker.example .env.docker
```

Remplacer tous les secrets factices, puis lancer :

```bash
npm run docker:up
```

Le site répond sur `http://localhost:8080`.

Commandes courantes :

```bash
npm run docker:logs
npm run docker:down
npm run docker:backup
```

### 5.4 Variables principales

Application :

- `NODE_ENV` : environnement courant ;
- `PORT` : port interne de Node.js ;
- `SITE_URL` : URL publique exacte ;
- `TRUST_PROXY` : confiance accordée à Nginx ;
- `TZ` : fuseau horaire.

Sécurité :

- `SESSION_SECRET` : signature des sessions ;
- `RATE_LIMIT_SECRET` : anonymisation des clés de limitation.

PostgreSQL :

- `DB_HOST` ;
- `DB_PORT` ;
- `DB_NAME` ;
- `DB_USER` ;
- `DB_PASSWORD`.

Stockage :

- `UPLOAD_ROOT` ;
- `ARCHIVE_DIRECTORY`.

Docker et Nginx :

- `APP_IMAGE` ;
- `NGINX_IMAGE` ;
- `NGINX_SERVER_NAME` ;
- `NGINX_CERTIFICATE_NAME` ;
- ports et chemins Let's Encrypt.

### 5.5 Initialisation PostgreSQL

Sur un volume PostgreSQL neuf, l'image officielle exécute
`database/init_db.sql`.

Ce fichier crée le schéma complet et les rôles `Admin` et `User`.

Ensuite, `scripts/run-migrations.js` applique les fichiers SQL de
`database/migrations` dans l'ordre alphabétique.

La table `schema_migration` conserve :

- le nom du fichier ;
- son empreinte SHA-256 ;
- sa date d'application.

Une migration appliquée ne doit jamais être modifiée. Il faut créer un nouveau
fichier pour chaque évolution.

Commande manuelle :

```bash
npm run migrate
```

### 5.6 Catalogue initial des jeux

Le service `seed` exécute `scripts/seed-games.js`.

Les valeurs se trouvent dans `database/seeds/games.sql`.

Le seed est idempotent. Il peut être exécuté plusieurs fois sans doublon.

Commande manuelle :

```bash
npm run seed:games
```

Les jeux ajoutés plus tard depuis l'administration restent en base. Le seed ne
les supprime pas.

### 5.7 Premier administrateur

La base neuve ne contient aucun compte.

La commande `npm run admin:create` crée le premier administrateur. Elle refuse
de fonctionner si un administrateur existe déjà.

Le mot de passe doit provenir d'un fichier privé monté dans le conteneur. Il ne
doit pas apparaître dans Git ni dans la ligne de commande.

La procédure complète se trouve dans `docs/docker.md`.

### 5.8 Import initial des fichiers

La commande suivante copie `public/uploads` vers le volume Docker :

```bash
npm run docker:import-files
```

Elle normalise les permissions des fichiers publics.

Elle n'importe aucune donnée PostgreSQL.

## 6. Sécurité

### 6.1 Mots de passe

Les mots de passe sont hachés avec bcrypt et un coût de `12`.

Ils ne sont jamais enregistrés en clair.

Le mot de passe d'un compte classique doit contenir 10 à 128 caractères.

Le premier administrateur exige au moins 12 caractères, une majuscule, une
minuscule, un chiffre et un symbole.

### 6.2 Sessions

Les sessions sont stockées dans PostgreSQL.

Le cookie se nomme `nordstrat.sid`.

Il utilise :

- `httpOnly` ;
- `sameSite=lax` ;
- `secure` en production ;
- une durée normale de 8 heures ;
- jusqu'à 30 jours avec « se souvenir de moi ».

La session est régénérée après une connexion ou une action sensible.

Les sessions d'un membre sont invalidées après certaines actions
administratives ou modifications du compte.

### 6.3 CSRF et origine

Chaque session reçoit un jeton CSRF aléatoire.

Les formulaires sensibles envoient ce jeton dans `_csrf`.

Les requêtes `POST` vérifient aussi `Origin` et `Sec-Fetch-Site`.

Les formulaires multipart passent par une validation adaptée après Multer.

### 6.4 Autorisations

Trois middlewares contrôlent l'accès :

- `requireGuest` : visiteur non connecté ;
- `requireUser` : membre connecté ;
- `requireAdmin` : administrateur connecté.

Toutes les routes `/admindashboard` passent par `requireAdmin`.

La sécurité ne repose donc pas uniquement sur l'affichage ou le masquage d'un
bouton.

### 6.5 En-têtes HTTP

Helmet configure notamment :

- une Content Security Policy ;
- l'interdiction des frames ;
- une politique de référent stricte ;
- HSTS en production ;
- la désactivation de plusieurs fonctionnalités navigateur inutiles.

Express masque aussi l'en-tête `X-Powered-By`.

### 6.6 Rate limiting

Les limites concernent notamment :

- l'authentification ;
- le formulaire de contact ;
- les messages de discussion ;
- les actions sensibles du compte ;
- les uploads.

Les compteurs sont conservés dans PostgreSQL. Ils survivent au redémarrage de
Node.js.

### 6.7 Uploads

Les formats admis sont JPEG, PNG et WebP.

Le type MIME annoncé ne suffit pas. La signature binaire réelle est vérifiée.

Les tailles maximales sont :

- avatar : 2 Mo ;
- logo de jeu : 2 Mo ;
- actualité : 5 Mo ;
- image de l'Assaut de Bruay : 5 Mo.

Les noms de fichiers sont remplacés par des UUID.

La suppression refuse les chemins qui sortent du dossier autorisé.

### 6.8 Isolation Docker

Node.js et PostgreSQL n'ont aucun port publié.

Les conteneurs applicatifs utilisent un système de fichiers en lecture seule,
des dossiers temporaires dédiés et `no-new-privileges`.

Les capacités Linux sont supprimées lorsque cela est possible.

### 6.9 Secrets

Les fichiers `.env`, certificats, clés privées, sauvegardes et uploads sont
exclus de Git.

Le fichier `.env.production` doit être protégé avec `chmod 600`.

La commande suivante vérifie sa cohérence sans afficher les secrets :

```bash
npm run production:check
```

### 6.10 Journal administratif

Les actions importantes sont enregistrées dans `audit_log`.

Le journal conserve les pseudonymes et les motifs. Il ne conserve pas les
adresses IP.

L'interface ne propose aucune suppression des logs.

## 7. Déploiement et exploitation

### 7.1 Préparation de production

Créer le fichier réel :

```bash
cp .env.production.example .env.production
chmod 600 .env.production
npm run production:check
```

Les valeurs `example.org`, les secrets factices et les images factices doivent
être remplacés.

### 7.2 Images Docker

Deux images sont prévues :

- image Node.js construite avec `Dockerfile` ;
- image Nginx construite avec `deploy/nginx/Dockerfile`.

Les images de production doivent utiliser un tag immuable.

Exemple :

```text
ghcr.io/organisation/nordstrat:2026.08.31-1
ghcr.io/organisation/nordstrat-nginx:2026.08.31-1
```

Le tag `latest` est déconseillé.

### 7.3 HTTPS

Le fichier `compose.production.yaml` complète la configuration principale.

Nginx écoute alors sur les ports publics 80 et 443.

Le certificat doit déjà exister dans le dossier Let's Encrypt configuré.

Commande de démarrage :

```bash
ENV_FILE=.env.production docker compose \
  --env-file .env.production \
  -f compose.yaml \
  -f compose.production.yaml \
  up -d
```

Si l'hébergeur possède déjà Nginx, Caddy ou Traefik, il faut choisir une seule
terminaison HTTPS et adapter la publication des ports.

### 7.4 Healthchecks

Nginx expose `/nginx-health` en interne.

Node.js expose `/health`. Cette route vérifie :

- la connexion PostgreSQL ;
- la lecture et l'écriture du dossier d'uploads ;
- la lecture et l'écriture du dossier d'archives.

Contrôle public :

```bash
curl --fail https://domaine.example/health
```

### 7.5 Journaux

```bash
npm run docker:logs
```

Cette commande suit les journaux Nginx, Node.js et PostgreSQL.

Les erreurs applicatives sont écrites dans la sortie standard de Node.js.

### 7.6 Sauvegardes

```bash
npm run docker:backup
```

La sauvegarde contient :

- un dump PostgreSQL ;
- les uploads ;
- les archives JSON ;
- un fichier de sommes SHA-256.

Le résultat est placé dans `backups/<date UTC>`.

Une copie doit être envoyée hors du serveur.

### 7.7 Restauration

La restauration est destructive. Elle exige une confirmation explicite.

```bash
CONFIRM_RESTORE=nordstrat \
  ./scripts/docker/restore.sh backups/<date UTC>
```

Le script vérifie les sommes et réalise une sauvegarde de sécurité avant la
restauration.

### 7.8 Retour arrière

```bash
./scripts/docker/rollback.sh registre/nordstrat:<ancienne-version>
```

Le rollback change l'image Node.js.

Il ne revient pas automatiquement sur une ancienne version de la base.

Les migrations doivent donc rester compatibles avec la version précédente
pendant une mise à jour sensible.

## 8. Fonctionnalités

Chaque fiche suit le même ordre : objectif, accès, parcours, données, sécurité,
tests et évolutions.

### 8.1 Comptes et authentification

#### Objectif

Créer un compte, se connecter, se déconnecter et protéger l'identité du membre.

#### Accès et routes

- `POST /account/register` : inscription d'un visiteur ;
- `POST /auth/login` : connexion ;
- `POST /auth/logout` : déconnexion ;
- `GET /account` : espace du membre.

#### Parcours

L'inscription valide les informations, le mot de passe et l'acceptation des
CGU. Le rôle `User` est attribué.

La connexion recherche l'adresse en minuscules et compare le hash bcrypt.

Une session neuve est créée après authentification.

#### Données

Modèles principaux : `Player` et `Role`.

Contrôleurs : `account.controller.js`, `auth.controller.js` et
`access.controller.js`.

Vue principale : `account.ejs`. La connexion et l'inscription utilisent la
modale `auth-modal.ejs`.

#### Sécurité

Rate limiting, CSRF, cookie sécurisé, hash bcrypt et messages d'erreur non
divulgateurs.

#### Tests

Les tests couvrent notamment le mauvais mot de passe et l'interdiction de
l'administration pour un membre simple.

#### Évolutions possibles

Réinitialisation du mot de passe par e-mail et double authentification des
administrateurs.

### 8.2 Gestion et suppression du compte

#### Objectif

Modifier les informations personnelles, l'e-mail et le mot de passe. Permettre
la suppression conforme du compte.

#### Routes

- `POST /account/profile` ;
- `POST /account/password` ;
- `POST /account/email` ;
- `POST /account/delete`.

#### Parcours

Les actions sensibles demandent le mot de passe courant.

Après un changement sensible, les anciennes sessions sont invalidées ou
renouvelées.

La suppression anonymise les données personnelles lorsque leur suppression
directe casserait l'historique nécessaire.

#### Données et sécurité

Le modèle principal est `Player`. Les relations sont nettoyées ou anonymisées
dans une transaction.

Le dernier administrateur ne doit pas devenir impossible à gérer.

#### Évolutions possibles

Ajouter une confirmation par e-mail et une période de rétractation.

### 8.3 Profil public et avatar

#### Objectif

Présenter un membre avec un avatar, une biographie et jusqu'à trois jeux favoris.

#### Routes

- `GET /members/:playerId` ;
- `POST /account/public-profile` ;
- `POST /account/avatar` ;
- `POST /account/avatar/default` ;
- `POST /account/avatar/delete`.

#### Parcours

Le membre choisit la visibilité de son profil. Il sélectionne jusqu'à trois
jeux et leur ordre.

Il peut téléverser un avatar ou choisir un avatar DiceBear déjà généré.

#### Données

Modèles : `Player`, `Game` et `PlayerGame`.

Contrôleur : `profile.controller.js`.

Vues : `account.ejs` et `public-profile.ejs`.

#### Sécurité

Avatar limité à 2 Mo. Signature réelle JPEG, PNG ou WebP. Le chemin final est
généré côté serveur.

#### Évolutions possibles

Compression automatique, redimensionnement et modération des images.

### 8.4 Catalogue des jeux

#### Objectif

Fournir la liste utilisée par les profils et les réservations.

#### Routes administratives

- `GET /admindashboard/games` ;
- `GET|POST /admindashboard/games/create` ;
- `GET /admindashboard/games/:gameId/edit` ;
- `POST /admindashboard/games/:gameId/update` ;
- `POST /admindashboard/games/:gameId/disable`.

#### Parcours

Un administrateur crée un jeu, définit ses limites de joueurs et ajoute un
logo facultatif.

Le nom est normalisé mot par mot.

La désactivation retire le jeu des nouveaux choix sans casser les anciennes
archives.

#### Données

Modèle : `Game`.

Contrôleur : `game.controller.js`.

Seed initial : `database/seeds/games.sql`.

Les logos statiques connus sont associés dans `game-image.service.js`.

#### Sécurité

Accès administrateur. Logo limité à 2 Mo et contenu vérifié.

#### Tests

Les tests contrôlent la priorité du logo importé et la résolution des logos
statiques.

### 8.5 Soirées hebdomadaires

#### Objectif

Créer le cadre temporel des réservations du vendredi.

#### Routes administratives

- `GET /admindashboard/events` ;
- `GET|POST /admindashboard/events/create` ;
- `GET /admindashboard/events/:eventId/edit` ;
- `POST /admindashboard/events/:eventId/update` ;
- `POST /admindashboard/events/:eventId/cancel` ;
- `POST /admindashboard/events/:eventId/reopen`.

#### Parcours

La première soirée doit être créée manuellement.

Sa date limite d'inscription doit précéder la soirée.

À 23 h 59 le vendredi, l'automatisation archive la soirée. Elle crée ensuite
la soirée située sept jours plus tard avec le même décalage de clôture.

La nouvelle soirée devient réservable dès sa création. En pratique, cela
correspond au début du samedi suivant l'archivage.

Une annulation supprime les tables et inscriptions. Une réouverture repart avec
des tables vierges.

#### Données

Modèle : `Event`.

Contrôleur : `event.controller.js`.

Automatisation : `server.js` et `BookingArchive.archiveDueEvents`.

#### Sécurité

Création, modification, annulation et réouverture réservées aux administrateurs.

Les opérations importantes sont transactionnelles et journalisées.

#### Tests

Un test vérifie qu'une date limite incohérente renvoie une erreur utile sans
créer de soirée.

#### Limite actuelle

Sans première soirée, aucune table n'est disponible et le cycle ne démarre pas.

### 8.6 Réservation des tables

#### Objectif

Permettre à un membre de créer ou rejoindre une table pour la prochaine soirée.

#### Routes

- `GET /booking` ;
- `POST /tables/create` ;
- `POST /tables/:tableId/join` ;
- `POST /tables/:tableId/leave` ;
- `POST /tables/:tableId/update` ;
- `POST /tables/:tableId/close` ;
- `POST /tables/:tableId/cancel`.

#### Parcours

La page présente huit emplacements.

Une table est disponible si :

- une soirée future existe ;
- son statut est `upcoming` ;
- `reservable` est vrai ;
- sa date limite n'est pas dépassée ;
- l'emplacement n'est pas fermé ;
- son numéro ne dépasse pas `maxTable`.

Le créateur choisit le jeu et le nombre maximal de joueurs. Il devient hôte et
premier inscrit.

Un membre ne peut avoir qu'une réservation confirmée par soirée.

Les autres membres peuvent rejoindre jusqu'à la capacité maximale.

Si l'hôte quitte une table occupée, le membre confirmé le plus ancien devient
hôte. Si personne ne reste, la table est supprimée.

L'hôte ou un administrateur peut modifier le jeu et la capacité. La capacité
ne peut pas devenir inférieure au nombre de participants.

#### Données

Modèles : `Event`, `GameTable`, `Reservation`, `Game` et
`EventTableClosure`.

Contrôleurs : `booking.controller.js`, `table.controller.js` et
`reservation.controller.js`.

Vue : `booking.ejs`.

#### Sécurité et concurrence

Les créations utilisent une transaction sérialisable.

Les lignes sont verrouillées pendant les opérations sensibles. Cela évite deux
réservations simultanées sur le même emplacement.

#### Cotisation

La page détermine si la cotisation courante est `paid` ou `exempted`.

Un membre non à jour peut réserver. Il n'est simplement pas prioritaire en cas
de manque de place. Une annulation administrative rappelle à l'admin de le
prévenir avec son pseudo et son e-mail.

#### Administration

Un administrateur peut fermer ou rouvrir chaque emplacement. Une fermeture
peut conserver les réservations déjà présentes.

#### Tests

Un parcours d'intégration crée une table puis publie une discussion depuis un
autre compte.

### 8.7 Discussions de table

#### Objectif

Permettre aux membres connectés d'échanger avant de rejoindre une table.

#### Routes

- `POST /tables/:tableId/discussion/open` ;
- `POST /tables/:tableId/comments` ;
- `POST /tables/:tableId/comments/:commentId/delete` pour un admin.

#### Parcours

Tout membre connecté peut lire et écrire, même sans réservation.

Un message contient 1 à 500 caractères.

Le système mémorise la dernière lecture afin d'afficher le nombre de nouveaux
messages.

Un membre ne peut pas supprimer son propre message. Seul un administrateur le
peut, avec un motif obligatoire.

#### Données

Modèles : `TableComment` et `TableDiscussionRead`.

Contrôleur : `table-discussion.controller.js`.

Partial : `table-discussion-panel.ejs`.

#### Sécurité

Rate limiting, validation de longueur et suppression journalisée avec motif et
extrait du message.

### 8.8 Présences

#### Objectif

Produire une statistique simple des intentions de présence.

#### Routes

- `POST /events/:eventId/attendance/cancel` ;
- `POST /events/:eventId/attendance/confirm` ;
- `GET|POST /admindashboard/events/:eventId/attendance`.

#### Parcours

Par défaut, une personne inscrite est considérée présente lors de l'archivage.

Le membre ou un administrateur peut indiquer une absence.

L'administrateur peut aussi annuler une réservation depuis cette page.

#### Données

Modèle : `EventAttendance`.

Contrôleur : `attendance.controller.js`.

Les informations utiles au jeu et à la table sont copiées pour l'archive.

### 8.9 Archivage et statistiques des soirées

#### Objectif

Vider les tables chaque semaine tout en conservant les statistiques finales.

#### Routes administratives

- `POST /admindashboard/events/:eventId/archive` ;
- `GET /admindashboard/archives` ;
- `GET /admindashboard/archives/:archiveId` ;
- `GET /admindashboard/archives/:archiveId/download`.

#### Parcours automatique

`server.js` vérifie chaque minute les soirées à archiver.

Une soirée du vendredi devient archivable à 23 h 59, heure de Paris.

L'archive contient :

- la soirée ;
- les tables ;
- les jeux ;
- les participants ;
- le statut de présence ;
- les totaux utiles aux statistiques.

L'instantané est stocké en JSONB dans PostgreSQL et exporté en fichier JSON.

Après l'archive, les tables, fermetures et présences sont supprimées. La soirée
devient `completed`.

La soirée suivante est créée automatiquement.

#### Données

Modèle : `BookingArchive`.

Contrôleur : `archive.controller.js`.

Dossier : `ARCHIVE_DIRECTORY`.

#### Fiabilité

Une archive est unique par soirée. Les fichiers manquants sont recréés depuis
PostgreSQL au démarrage.

### 8.10 Actualités

#### Objectif

Publier des articles visibles par tous et alimenter le bandeau de l'accueil.

#### Routes publiques

- `GET /news` ;
- `GET /news/:postId`.

#### Routes administratives

- `GET /admindashboard/news` ;
- `GET|POST /admindashboard/news/create` ;
- `GET /admindashboard/news/:postId/edit` ;
- `POST /admindashboard/news/:postId/update` ;
- `POST /admindashboard/news/:postId/delete`.

#### Parcours

Un administrateur saisit un titre, un texte et une image facultative.

La liste publique affiche des cartes avec auteur et résumé.

La page d'accueil récupère les cinq dernières actualités.

L'auteur est affiché avec son pseudo et son avatar.

#### Données

Modèle : `NewsPost`, relié à `Player`.

Contrôleurs : `news.controller.js` et `home.controller.js`.

Vues : `news-list.ejs`, `news-details.ejs` et les vues administratives.

#### Sécurité

Création, modification et suppression réservées aux administrateurs. Image
limitée à 5 Mo et validée par signature.

### 8.11 Contact et messagerie interne

#### Objectif

Recevoir les messages des visiteurs et des membres dans l'administration.

#### Routes

- `GET|POST /contact` ;
- `GET /admindashboard/inbox` ;
- `POST /admindashboard/inbox/:messageId/status`.

#### Parcours

Le formulaire collecte nom, e-mail, téléphone facultatif, sujet et message.

Un champ invisible sert de piège simple contre les robots.

Le message est stocké en base avec le statut `unread`.

Un administrateur peut le passer en `read` ou `archived`.

#### Données

Modèle : `ContactMessage`.

Contrôleurs : `contact.controller.js` et `message-admin.controller.js`.

#### Sécurité

Rate limiting, validation des longueurs et validation de l'e-mail.

#### Limite actuelle

Le formulaire n'envoie pas directement d'e-mail à Gmail. Les messages restent
dans PostgreSQL et dans la messagerie administrative.

### 8.12 Gestion des membres

#### Objectif

Donner aux administrateurs une vue sur les comptes et des outils de modération.

#### Routes

- `GET /admindashboard/members` ;
- `POST /admindashboard/members/:playerId/role` ;
- `POST /admindashboard/members/:playerId/moderation`.

#### Parcours

La liste affiche les informations principales. Une modale présente les détails
et les actions.

Un administrateur peut :

- modifier un rôle ;
- suspendre temporairement ;
- suspendre définitivement ;
- réactiver un compte.

Un motif est obligatoire pour une suspension.

Les suspensions temporaires expirées sont réactivées automatiquement lors du
chargement du compte.

#### Données

Modèles : `Player` et `Role`.

Contrôleur : `account-admin.controller.js`.

#### Sécurité

Un administrateur ne peut pas se retirer lui-même son rôle ni suspendre son
propre compte.

Les sessions du compte ciblé sont invalidées. Toutes les actions sont
journalisées.

### 8.13 Cotisations

#### Objectif

Suivre manuellement les cotisations de septembre à août.

#### Routes

- `GET /admindashboard/memberships` ;
- `POST /admindashboard/members/:playerId/memberships`.

#### Parcours

La saison commence le 1er septembre et finit le 31 août.

Les statuts sont :

- `unpaid` ;
- `paid` ;
- `exempted` ;
- `cancelled`.

Pour un paiement, l'administrateur choisit le mode : espèces, chèque, virement,
carte ou autre.

Le tableau propose la saison courante et un historique limité.

#### Données

Modèle : `Membership`.

Contrôleur : `membership.controller.js`.

#### Sécurité

Accès administrateur, transaction PostgreSQL et journalisation de l'ancien et
du nouveau statut.

#### Évolution prévue

Un rapprochement bancaire pourra compléter la saisie manuelle. Aucune
intégration bancaire n'existe actuellement.

### 8.14 Assaut de Bruay

#### Objectif

Présenter l'événement annuel et centraliser les candidatures des partenaires,
vendeurs et bénévoles.

#### Routes membres

- `GET /events/assaut-de-bruay` ;
- `GET /events/assaut-de-bruay/registration` ;
- `POST /events/assaut-de-bruay/apply` ;
- routes `/account/assaut-de-bruay` pour consulter, modifier ou retirer une
  candidature bénévole.

#### Routes administratives

- `GET|POST /admindashboard/assaut-de-bruay` ;
- `GET /admindashboard/assaut-de-bruay/applications` ;
- `GET /admindashboard/assaut-de-bruay/applications/:applicationId` ;
- `POST /admindashboard/assaut-de-bruay/applications/:applicationId/status`.

#### Parcours

L'administrateur définit le titre, la présentation, l'image, les dates de
l'événement, les dates d'inscription et la visibilité.

La page publique n'apparaît dans la navigation que lorsqu'elle est visible.

Un compte connecté choisit un type de candidature : partenaire, vendeur ou
bénévole.

Partenaires et vendeurs renseignent les personnes, jours de présence, longueur
d'emplacement de 2 à 6 mètres, tables, chaises, électricité, eau, site web et
réseaux sociaux.

Les bénévoles choisissent des missions et décrivent leurs besoins.

Une candidature passe par `new`, `reviewing`, `accepted`, `waitlisted`,
`rejected` ou `withdrawn`.

Une candidature bénévole reste modifiable dans les premiers statuts. Elle peut
être retirée même après acceptation selon les statuts autorisés.

#### Données

Modèles : `PublicEvent` et `PublicEventApplication`.

Contrôleur : `public-event.controller.js`.

#### Sécurité

Compte obligatoire, rate limiting, validation des bornes matérielles et image
limitée à 5 Mo.

Les changements administratifs sont journalisés.

### 8.15 Tableau de bord administratif

#### Objectif

Centraliser les outils et afficher les indicateurs principaux.

#### Route

- `GET /admindashboard`.

#### Indicateurs

Le tableau affiche notamment :

- prochaine soirée réservable ;
- membres actifs ;
- cotisations à jour ou manquantes ;
- messages non lus ;
- jeux disponibles ;
- archives ;
- actualités ;
- logs ;
- nouvelles candidatures à l'Assaut de Bruay.

#### Données

Contrôleur : `admin.controller.js`.

Vue : `adminDashboard.ejs`.

Toutes les sous-pages utilisent `admin-navigation.ejs`.

### 8.16 Journal administratif

#### Objectif

Tracer les opérations sensibles sans collecter d'adresse IP.

#### Route

- `GET /admindashboard/audit-log`.

#### Contenu

Un log contient :

- l'administrateur ;
- la catégorie ;
- l'action ;
- la cible ;
- une description ;
- la date.

Les catégories couvrent les tables, membres, cotisations, actualités et
événements publics.

#### Recherche

La page permet de filtrer par administrateur, membre ciblé, catégorie ou type
d'action. Elle affiche 30 éléments par page.

#### Données

Modèle : `AuditLog`.

Contrôleur : `audit-log.controller.js`.

Service d'écriture : `audit-log.service.js`.

#### Limite volontaire

Aucune route ne supprime un log.

### 8.17 Pages publiques et SEO

#### Pages

- accueil `/` ;
- actualités `/news` ;
- à propos `/about` ;
- contact `/contact` ;
- accessibilité `/accessibility` ;
- CGU `/cgu` ;
- mentions légales `/mentions-legales` ;
- confidentialité `/politique-confidentialite`.

#### SEO

`seo.controller.js` fournit :

- titres et descriptions ;
- URL canonique ;
- directives robots ;
- données structurées ;
- `robots.txt` ;
- `sitemap.xml`.

Les pages privées sont exclues de l'indexation.

Le site contient aussi un manifeste et des icônes.

#### Erreurs

Les pages 404 et 500 utilisent des vues dédiées, cohérentes avec le thème de
l'association.

## 9. Modèles et relations principales

### 9.1 Comptes

```text
Role 1 ─── n Player
Player n ─── n Game via PlayerGame
Player 1 ─── n Membership
```

### 9.2 Réservations

```text
Event 1 ─── n GameTable
Game 1 ─── n GameTable
Player 1 ─── n GameTable comme hôte
GameTable 1 ─── n Reservation
Player 1 ─── n Reservation
Event 1 ─── n Reservation
```

### 9.3 Discussions et présence

```text
GameTable 1 ─── n TableComment
Player 1 ─── n TableComment
GameTable n ─── n Player via TableDiscussionRead
Event 1 ─── n EventAttendance
```

### 9.4 Contenu

```text
Player 1 ─── n NewsPost
Player 1 ─── n ContactMessage facultatif
PublicEvent 1 ─── n PublicEventApplication
```

### 9.5 Administration

```text
Player 1 ─── n AuditLog comme administrateur
Event 1 ─── 0..1 BookingArchive
```

Le détail exhaustif des clés étrangères se trouve dans `models/relations.js`
et `database/init_db.sql`.

## 10. Frontend, responsive et accessibilité

### 10.1 Vues

Les pages se trouvent dans `views/layouts`.

Les éléments partagés se trouvent dans `views/partials` :

- en-tête ;
- pied de page ;
- modale d'authentification ;
- messages flash ;
- navigation administrative ;
- panneau de discussion.

### 10.2 CSS

La source Tailwind est `public/css/input.css`.

Le fichier généré est `public/css/output.css`.

Après une modification des classes ou des vues :

```bash
npm run build:css
```

### 10.3 JavaScript navigateur

Les scripts se trouvent dans `public/js`.

Ils gèrent notamment :

- menu mobile ;
- modale de connexion ;
- messages temporaires ;
- états de soumission ;
- discussions ;
- aperçu des jeux ;
- tableaux administratifs ;
- validation du formulaire de soirée.

La logique métier importante reste validée côté serveur.

### 10.4 Responsive

Le menu devient un menu burger sur mobile.

Les tableaux administratifs utilisent des vues allégées et des modales.

La page de réservation utilise un panneau latéral sur ordinateur et un affichage
intégré sur mobile.

### 10.5 Accessibilité

Le projet prévoit notamment :

- un titre principal par page ;
- des libellés de formulaires ;
- des messages d'erreur visibles ;
- la navigation clavier des modales ;
- des états de chargement annoncés ;
- une page d'accessibilité ;
- des alternatives textuelles adaptées aux images utiles.

Une vérification manuelle au clavier et au lecteur d'écran reste nécessaire
avant chaque mise en production importante.

## 11. Tests

### 11.1 Organisation

```text
tests/unit/         règles isolées
tests/smoke/        compilation des vues et structure HTML
tests/integration/  parcours Express avec PostgreSQL
```

### 11.2 Commandes

```bash
npm test
npm run test:unit
npm run test:integration
npm run check
```

### 11.3 Base de test

Les tests d'intégration exigent une base ou un schéma dont le nom finit par
`_test`.

Cette protection évite de vider accidentellement une base réelle.

Les tests réinitialisent entièrement leur cible.

### 11.4 Couverture actuelle

Les tests couvrent notamment :

- connexion refusée avec un mauvais mot de passe ;
- interdiction des routes admin à un membre ;
- validation d'une soirée ;
- création et discussion d'une table ;
- upload multipart protégé par CSRF ;
- archivage JSON ;
- compilation des vues ;
- contrôles d'accès ;
- détection du contenu réel des images ;
- protection contre la sortie des dossiers d'uploads.

### 11.5 Recette manuelle

La checklist se trouve dans `docs/recette-mvp.md`.

Elle doit être rejouée sur ordinateur et mobile avant la production.

## 12. Maintenance

### 12.1 Ajouter une route

1. Créer ou compléter un contrôleur ciblé.
2. Ajouter la route dans `router/routes.js`.
3. Ajouter le middleware `requireUser` ou `requireAdmin` si nécessaire.
4. Ajouter un formulaire avec jeton CSRF pour toute action d'écriture.
5. Ajouter un test.

### 12.2 Ajouter un modèle

1. Créer un fichier dans `models`.
2. L'importer dans `models/relations.js`.
3. Déclarer les relations.
4. L'exporter depuis `models/index.js`.
5. Créer une nouvelle migration SQL.
6. Ajouter les contraintes au niveau PostgreSQL et Sequelize.

### 12.3 Modifier la base

Ne jamais modifier une migration déjà appliquée.

Créer un nouveau fichier daté dans `database/migrations`.

Tester sur une base vide et sur une base déjà initialisée.

### 12.4 Ajouter un jeu initial

Modifier `database/seeds/games.sql`.

Le seed mettra à jour le jeu par son nom insensible à la casse.

Un jeu ajouté uniquement depuis l'administration n'a pas besoin d'être ajouté
au seed, sauf s'il doit exister sur toute installation neuve.

### 12.5 Ajouter un type d'upload

1. Ajouter la catégorie autorisée dans `upload-storage.service.js`.
2. Définir la taille maximale dans le contrôleur concerné.
3. Ajouter la route multipart aux règles CSRF.
4. Monter ou servir le dossier avec Nginx.
5. Ajouter des tests de signature et de suppression.

### 12.6 Avant une livraison

```bash
npm test
npm run build:css
git diff --check
docker compose --env-file .env.docker config --quiet
```

Puis vérifier :

- aucune donnée sensible dans Git ;
- migrations réentrantes ;
- images Docker construites ;
- healthchecks sains ;
- sauvegarde récente ;
- rollback disponible.

## 13. Dépannage

### 13.1 Le site Docker ne répond pas

```bash
docker compose --env-file .env.docker ps
npm run docker:logs
```

Vérifier que `db`, `app` et `nginx` sont `healthy`.

### 13.2 PostgreSQL est indisponible

Vérifier les variables `DB_*` et `POSTGRES_*`.

Dans Docker, `DB_HOST` doit être `db`.

Les mots de passe `POSTGRES_PASSWORD` et `DB_PASSWORD` doivent correspondre.

### 13.3 Les tables de réservation sont indisponibles

Vérifier qu'une soirée future existe avec :

- statut `upcoming` ;
- `reservable=true` ;
- date limite future ;
- au moins une table autorisée.

Une base neuve demande la création manuelle de la première soirée.

### 13.4 Erreur d'origine ou CSRF

Vérifier que l'utilisateur ouvre exactement l'URL définie dans `SITE_URL`.

Vérifier que Nginx transmet le host, le port et le protocole.

Avec Nginx devant Express, `TRUST_PROXY=1` est attendu dans cette architecture.

### 13.5 Une image renvoie 403

Vérifier les droits du volume `uploads_data`.

Nginx doit pouvoir lire les fichiers et traverser les dossiers.

La commande `npm run docker:import-files` normalise les imports initiaux.

### 13.6 Une image renvoie 404

Vérifier son chemin en base et sa présence réelle dans le volume.

Les images statiques doivent exister dans `public/images` au moment de la
construction de l'image Nginx.

### 13.7 Une migration échoue

Lire les logs du service :

```bash
docker compose --env-file .env.docker logs migrate
```

Ne jamais modifier l'empreinte d'une migration déjà appliquée pour contourner
l'erreur.

### 13.8 Le premier administrateur ne peut pas être créé

Vérifier que le fichier du mot de passe est un fichier régulier et non un
dossier.

Vérifier ses droits avec `chmod 600`.

La commande refuse également de fonctionner si un admin existe déjà.

## 14. Points de vigilance actuels

### 14.1 Première soirée

Le cycle automatique dépend d'une première soirée créée manuellement.

### 14.2 Permissions des nouveaux uploads avec Nginx séparé

Le service de stockage crée actuellement les nouveaux fichiers avec le mode
`0600`.

Node.js peut les lire, mais le conteneur Nginx utilise un autre utilisateur.
Selon les permissions du volume, un nouvel upload peut donc produire une
réponse `403` depuis Nginx.

Avant la production, il faut définir une stratégie stable : groupe partagé,
ACL ou création en lecture pour Nginx. Il ne faut pas rendre le dossier entier
inscriptible par Nginx.

### 14.3 Images d'accueil manquantes

Les vues référencent actuellement `asso1.jpg` à `asso4.jpg`.

Ces fichiers doivent exister dans `public/images` avant la construction Nginx.

### 14.4 E-mails

Le formulaire de contact stocke les messages en base. Il ne transmet pas encore
de notification vers `nord.strategie@gmail.com`.

### 14.5 CI/CD

La construction Docker est prête, mais le pipeline GitHub de test, publication
des images et déploiement reste à mettre en place.

### 14.6 Supervision

`/health` existe, mais l'hébergeur doit encore configurer une surveillance
externe, des alertes et le suivi de l'espace disque.

## 15. Références internes

- `docs/docker.md` : commandes Docker détaillées ;
- `docs/production-handoff.md` : remise à l'hébergeur ;
- `docs/recette-mvp.md` : recette fonctionnelle ;
- `.env.example` : environnement local ;
- `.env.production.example` : environnement de production ;
- `database/init_db.sql` : schéma initial ;
- `models/relations.js` : relations Sequelize ;
- `router/routes.js` : liste réelle des routes.
