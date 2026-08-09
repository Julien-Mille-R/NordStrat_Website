# Tests

Le dossier est séparé en trois niveaux :

- `unit/` : règles isolées, sans accès à PostgreSQL ;
- `smoke/` : compilation des vues et présence des éléments HTML essentiels ;
- `integration/` : parcours HTTP complets avec Express, sessions et PostgreSQL.

## Commandes

```bash
npm test
npm run test:unit
npm run test:integration
```

Les tests d’intégration sont ignorés si aucune cible de test n’est définie. En local, `TEST_DATABASE_SCHEMA=nordstrat_test` crée un schéma isolé dans la base configurée par `.env`. En CI, `TEST_DATABASE_URL` peut cibler une base éphémère. Le nom de la base ou du schéma doit obligatoirement se terminer par `_test` et son contenu est entièrement réinitialisé.

Exemple de configuration : copier `.env.test.example` vers `.env.test`, renseigner les secrets puis lancer `npm run test:integration`. Ce fichier local est ignoré par Git.
