# Recette MVP avant mise en production

Cette checklist complète les tests automatisés. Elle doit être rejouée sur ordinateur et mobile avant chaque livraison importante.

## Comptes et permissions

- connexion valide, mot de passe incorrect et déconnexion ;
- création d’un compte et messages de validation ;
- modification de l’e-mail et du mot de passe, avec invalidation des anciennes sessions ;
- refus de toutes les routes `/admindashboard` avec un compte User ;
- suspension temporaire, définitive et réactivation d’un compte de test.

## Réservations

- création, modification, fermeture, réouverture et annulation d’une table ;
- inscription et désinscription d’un second joueur ;
- refus d’une seconde réservation pour la même soirée ;
- discussion accessible à un membre non inscrit et modération par un admin ;
- archivage de la soirée et contrôle du fichier JSON produit.

## Formulaires et fichiers

- contact et candidatures Assaut de Bruay avec erreurs visibles ;
- import JPEG, PNG et WebP valide ;
- refus d’un mauvais type, d’un faux contenu et d’un fichier trop volumineux ;
- création et modification d’une actualité et d’un logo de jeu.

## Accessibilité et responsive

- parcours complet au clavier, focus toujours visible et ordre logique ;
- zoom navigateur à 200 % sans perte d’information ni défilement horizontal global ;
- lecture des erreurs, notifications et modales avec un lecteur d’écran ;
- contrôle à 320 px, 768 px, 1024 px et grand écran ;
- vérification du menu mobile, des tableaux admin, de `/account` et de `/booking` ;
- Lighthouse et axe sans erreur critique sur les pages publiques principales.

## Production

- page 404 et page 500 sans détail technique ;
- HTTPS, cookies sécurisés, CSP et redirection HTTP ;
- `robots.txt`, sitemap, canoniques et données structurées ;
- sauvegarde PostgreSQL et restauration testée avant ouverture publique.
