BEGIN;

CREATE TABLE IF NOT EXISTS public_event (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    event_date DATE NOT NULL,
    registration_open_at DATE NOT NULL,
    registration_close_at DATE NOT NULL,
    description TEXT NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT false,
    applications_enabled BOOLEAN NOT NULL DEFAULT false,
    created_by INTEGER NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_public_event_dates CHECK (
        registration_open_at <= registration_close_at
        AND registration_close_at < event_date
    )
);

CREATE INDEX IF NOT EXISTS idx_public_event_visibility_date
    ON public_event(is_visible, event_date);

CREATE TABLE IF NOT EXISTS public_event_application (
    id SERIAL PRIMARY KEY,
    public_event_id INTEGER NOT NULL REFERENCES public_event(id) ON DELETE CASCADE,
    application_type VARCHAR(20) NOT NULL,
    contact_name VARCHAR(120) NOT NULL,
    organization_name VARCHAR(150),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    description TEXT NOT NULL,
    availability TEXT,
    needs TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    reviewed_by INTEGER REFERENCES player(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_public_application_type
        CHECK (application_type IN ('partner', 'volunteer')),
    CONSTRAINT check_public_application_status
        CHECK (status IN ('new', 'reviewing', 'accepted', 'waitlisted', 'rejected')),
    CONSTRAINT check_public_application_details CHECK (
        (application_type = 'partner' AND organization_name IS NOT NULL)
        OR
        (application_type = 'volunteer' AND availability IS NOT NULL)
    ),
    CONSTRAINT check_public_application_review CHECK (
        (status = 'new' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR
        (status <> 'new' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_public_application_event_type_status
    ON public_event_application(public_event_id, application_type, status);

CREATE INDEX IF NOT EXISTS idx_public_application_email
    ON public_event_application(email);

COMMIT;
