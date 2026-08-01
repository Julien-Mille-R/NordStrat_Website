BEGIN;

ALTER TABLE public_event
    ADD COLUMN IF NOT EXISTS event_end_date DATE;

UPDATE public_event
SET event_end_date = event_date
WHERE event_end_date IS NULL;

ALTER TABLE public_event
    ALTER COLUMN event_end_date SET NOT NULL;

ALTER TABLE public_event
    DROP CONSTRAINT IF EXISTS check_public_event_dates;

ALTER TABLE public_event
    ADD CONSTRAINT check_public_event_dates CHECK (
        event_date <= event_end_date
        AND registration_open_at <= registration_close_at
        AND registration_close_at < event_date
    );

ALTER TABLE public_event_application
    ADD COLUMN IF NOT EXISTS player_id INTEGER REFERENCES player(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS participant_count INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS present_saturday BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS present_sunday BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS table_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS chair_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS needs_electricity BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS power_outlet_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS needs_water BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS space_details TEXT,
    ADD COLUMN IF NOT EXISTS website_url TEXT,
    ADD COLUMN IF NOT EXISTS volunteer_tasks JSONB NOT NULL DEFAULT '[]'::jsonb;

WITH matched_applications AS (
    SELECT
        application.id AS application_id,
        player.id AS player_id,
        ROW_NUMBER() OVER (
            PARTITION BY application.public_event_id, player.id, application.application_type
            ORDER BY application.created_at DESC, application.id DESC
        ) AS match_position
    FROM public_event_application application
    JOIN player ON LOWER(application.email) = LOWER(player.email)
    WHERE application.player_id IS NULL
)
UPDATE public_event_application application
SET player_id = matched.player_id
FROM matched_applications matched
WHERE application.id = matched.application_id
  AND matched.match_position = 1;

-- Les anciennes candidatures ne distinguaient pas les deux journées.
UPDATE public_event_application
SET present_saturday = true
WHERE present_saturday = false
  AND present_sunday = false;

ALTER TABLE public_event_application
    DROP CONSTRAINT IF EXISTS check_public_application_type,
    DROP CONSTRAINT IF EXISTS check_public_application_details,
    DROP CONSTRAINT IF EXISTS check_public_application_days,
    DROP CONSTRAINT IF EXISTS check_public_application_participant_count,
    DROP CONSTRAINT IF EXISTS check_public_application_equipment;

ALTER TABLE public_event_application
    ADD CONSTRAINT check_public_application_type
        CHECK (application_type IN ('partner', 'vendor', 'volunteer')),
    ADD CONSTRAINT check_public_application_details CHECK (
        (application_type IN ('partner', 'vendor') AND organization_name IS NOT NULL)
        OR application_type = 'volunteer'
    ),
    ADD CONSTRAINT check_public_application_days CHECK (
        present_saturday OR present_sunday
    ),
    ADD CONSTRAINT check_public_application_participant_count CHECK (
        participant_count BETWEEN 1 AND 100
    ),
    ADD CONSTRAINT check_public_application_equipment CHECK (
        table_count BETWEEN 0 AND 100
        AND chair_count BETWEEN 0 AND 500
        AND power_outlet_count BETWEEN 0 AND 50
        AND jsonb_typeof(volunteer_tasks) = 'array'
    );

CREATE INDEX IF NOT EXISTS idx_public_application_player
    ON public_event_application(player_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_public_application_player_type
    ON public_event_application(public_event_id, player_id, application_type)
    WHERE player_id IS NOT NULL;

COMMIT;
