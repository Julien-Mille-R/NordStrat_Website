ALTER TABLE player
ADD COLUMN can_book_tables BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN player.can_book_tables IS
'Autorise un utilisateur à créer ou rejoindre une table de jeu. Les administrateurs disposent automatiquement de ce droit.';
