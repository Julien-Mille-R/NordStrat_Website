BEGIN;

ALTER TABLE public_event_application
    ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT,
    ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;

ALTER TABLE public_event_application
    DROP CONSTRAINT IF EXISTS check_public_application_status,
    DROP CONSTRAINT IF EXISTS check_public_application_review,
    DROP CONSTRAINT IF EXISTS check_public_application_withdrawal;

ALTER TABLE public_event_application
    ADD CONSTRAINT check_public_application_status CHECK (
        status IN ('new', 'reviewing', 'accepted', 'waitlisted', 'rejected', 'withdrawn')
    ),
    ADD CONSTRAINT check_public_application_review CHECK (
        (status = 'new' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR
        (status NOT IN ('new', 'withdrawn') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
        OR
        status = 'withdrawn'
    ),
    ADD CONSTRAINT check_public_application_withdrawal CHECK (
        (status = 'withdrawn' AND withdrawn_at IS NOT NULL)
        OR
        (status <> 'withdrawn' AND withdrawn_at IS NULL AND withdrawal_reason IS NULL)
    );

COMMIT;
