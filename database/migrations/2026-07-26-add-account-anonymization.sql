BEGIN;

ALTER TABLE player
    ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

ALTER TABLE player
    DROP CONSTRAINT IF EXISTS check_player_moderation_status;

ALTER TABLE player
    ADD CONSTRAINT check_player_moderation_status CHECK (
        moderation_status IN (
            'active',
            'temporarily_suspended',
            'permanently_suspended',
            'deleted'
        )
    );

ALTER TABLE player
    DROP CONSTRAINT IF EXISTS check_player_anonymization;

ALTER TABLE player
    ADD CONSTRAINT check_player_anonymization CHECK (
        (moderation_status = 'deleted' AND is_active = false AND anonymized_at IS NOT NULL)
        OR
        (moderation_status <> 'deleted' AND anonymized_at IS NULL)
    );

COMMIT;
