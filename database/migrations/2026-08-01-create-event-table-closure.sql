BEGIN;

CREATE TABLE IF NOT EXISTS event_table_closure (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL CHECK (table_number BETWEEN 1 AND 8),
    closed_by INTEGER NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_table_closure UNIQUE (event_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_event_table_closure_closed_by
    ON event_table_closure(closed_by);

COMMIT;
