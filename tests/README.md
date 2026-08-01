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

Les tests d’intégration sont ignorés si `TEST_DATABASE_URL` n’est pas défini. La base indiquée doit être dédiée aux tests et son nom doit obligatoirement se terminer par `_test`. Son schéma est entièrement réinitialisé pendant les tests.

Exemple de configuration : copier `.env.test.example` vers `.env.test`, renseigner les secrets puis lancer `npm run test:integration`. Ce fichier local est ignoré par Git.
