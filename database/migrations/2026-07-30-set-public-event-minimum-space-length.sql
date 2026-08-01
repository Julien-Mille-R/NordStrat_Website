BEGIN;

UPDATE public_event_application
SET space_length = 2
WHERE space_length = 1;

ALTER TABLE public_event_application
    DROP CONSTRAINT IF EXISTS check_public_application_equipment;

ALTER TABLE public_event_application
    ADD CONSTRAINT check_public_application_equipment CHECK (
        table_count BETWEEN 0 AND 6
        AND chair_count BETWEEN 0 AND 500
        AND power_outlet_count BETWEEN 0 AND 50
        AND (space_length IS NULL OR space_length BETWEEN 2 AND 6)
        AND jsonb_typeof(volunteer_tasks) = 'array'
    );

COMMIT;
