# Rapport mensuel par e-mail

## À quoi sert-il ?

Le premier de chaque mois, le site prépare un résumé du mois précédent et
l'envoie à la boîte de l'association. Il présente les membres, cotisations,
soirées, tables, jeux et actualités sous forme de statistiques agrégées.

Le rapport ne contient pas les noms, pseudonymes ou adresses des membres.

## Configuration locale

Compléter `.env` sans partager ce fichier ni le placer dans Git :

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=identifiant-smtp-brevo
SMTP_PASSWORD=cle-smtp-brevo
MAIL_FROM_NAME=Nord Stratégie
MAIL_FROM_ADDRESS=adresse-validee-chez-brevo
MONTHLY_REPORT_ENABLED=true
MONTHLY_REPORT_RECIPIENT=nord.strategie@gmail.com
```

`MAIL_FROM_ADDRESS` doit être une adresse ou un domaine autorisé dans Brevo.
La clé SMTP ne doit jamais être copiée dans un fichier `.example`.

## Envoyer un mail de test

Avec Node.js et PostgreSQL lancés localement :

```bash
npm run report:test
```

Avec l'environnement Docker :

```bash
npm run report:test -- --docker
```

La commande annonce qu'un vrai mail va être envoyé et demande confirmation.
Elle utilise `MONTHLY_REPORT_RECIPIENT` comme destinataire.

Pour une exécution volontairement non interactive :

```bash
npm run report:test -- --docker --yes
```

Le test fonctionne même si `MONTHLY_REPORT_ENABLED=false`. Il n'écrit pas le
marqueur d'envoi mensuel et ne peut donc pas empêcher le prochain envoi
automatique.

## Envoi automatique

L'automatisation nécessite `MONTHLY_REPORT_ENABLED=true`. L'application vérifie
chaque heure si la date locale est le premier du mois. Une erreur Brevo ou
PostgreSQL est inscrite dans les journaux et une nouvelle tentative est faite
au contrôle suivant.

Après un succès, le fichier suivant conserve le mois traité :

```text
ARCHIVE_DIRECTORY/system/monthly-report-state.json
```

Ce fichier empêche les doublons après un redémarrage. Il ne faut pas le
supprimer pour forcer un test : utiliser la commande `report:test`.

## En cas d'échec

Vérifier dans cet ordre :

1. les variables SMTP dans le fichier `.env` réellement utilisé ;
2. la validation de l'adresse d'expédition dans Brevo ;
3. la connexion de l'application à PostgreSQL ;
4. l'accès sortant du serveur au port SMTP configuré ;
5. les journaux Node.js avec `npm run docker:logs` en environnement Docker.
