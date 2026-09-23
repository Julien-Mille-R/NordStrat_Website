BEGIN;

-- ============================================================
-- Pseudo obligatoire et unique, insensible à la casse.
--
-- Cette migration refuse de continuer si des comptes existants
-- ne possèdent pas de pseudo ou si plusieurs comptes partagent
-- le même pseudo.
--
-- Les comptes anonymisés sont exclus de l'unicité.
-- ============================================================

DO $$
DECLARE
    missing_count INTEGER;
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO missing_count
    FROM player
    WHERE moderation_status <> 'deleted'
      AND (nickname IS NULL OR BTRIM(nickname) = '');

    IF missing_count > 0 THEN
        RAISE EXCEPTION
            'Migration interrompue : % compte(s) actif(s) n''ont pas de pseudonyme. Corrigez-les avant d''appliquer cette migration.',
            missing_count;
    END IF;

    SELECT COUNT(*)
    INTO duplicate_count
    FROM (
        SELECT LOWER(BTRIM(nickname))
        FROM player
        WHERE moderation_status <> 'deleted'
        GROUP BY LOWER(BTRIM(nickname))
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION
            'Migration interrompue : % pseudonyme(s) sont utilisés par plusieurs comptes. Corrigez les doublons avant d''appliquer cette migration.',
            duplicate_count;
    END IF;
END
$$;

-- Nettoyage des espaces superflus présents dans les données existantes.
UPDATE player
SET nickname = BTRIM(nickname)
WHERE nickname IS NOT NULL
  AND nickname <> BTRIM(nickname);

-- Le pseudo devient obligatoire.
ALTER TABLE player
    ALTER COLUMN nickname SET NOT NULL;

-- Unicité insensible à la casse.
--
-- Les comptes anonymisés sont exclus afin que
-- "Utilisateur supprimé" puisse rester une valeur d'anonymisation
-- sans bloquer les suppressions futures.
CREATE UNIQUE INDEX unique_player_nickname_lower
    ON player (LOWER(nickname))
    WHERE moderation_status <> 'deleted';

COMMIT;