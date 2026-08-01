BEGIN;

CREATE TABLE IF NOT EXISTS rate_limit_counter (
  key_hash CHAR(64) PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1 CHECK (hits >= 0),
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counter_reset_at
  ON rate_limit_counter(reset_at);

COMMIT;
