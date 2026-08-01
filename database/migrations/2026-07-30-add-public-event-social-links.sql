BEGIN;

ALTER TABLE public_event_application
    ADD COLUMN IF NOT EXISTS social_url_1 TEXT,
    ADD COLUMN IF NOT EXISTS social_url_2 TEXT;

COMMIT;
