CREATE TABLE password_reset_token (
    id BIGSERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX password_reset_token_player_id_idx
    ON password_reset_token(player_id);

CREATE INDEX password_reset_token_expires_at_idx
    ON password_reset_token(expires_at);