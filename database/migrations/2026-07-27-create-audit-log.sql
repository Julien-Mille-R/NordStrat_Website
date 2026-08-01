BEGIN;

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES player(id) ON DELETE SET NULL,
    admin_nickname VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL,
    action VARCHAR(60) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    target_label VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_audit_log_category CHECK (
        category IN ('game_tables', 'members', 'memberships', 'news', 'public_events')
    ),
    CONSTRAINT check_audit_log_description_length CHECK (
        CHAR_LENGTH(description) BETWEEN 1 AND 1000
    )
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
    ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_category_created_at
    ON audit_log(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id
    ON audit_log(admin_id);

CREATE OR REPLACE FUNCTION prevent_audit_log_deletion()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Les entrées du journal d''audit ne peuvent être ni modifiées ni supprimées.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_prevent_delete ON audit_log;
CREATE TRIGGER audit_log_prevent_delete
BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_log
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_audit_log_deletion();

COMMIT;
