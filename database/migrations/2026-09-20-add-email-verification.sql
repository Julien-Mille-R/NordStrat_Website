ALTER TABLE player
ADD COLUMN email_verified_at TIMESTAMPTZ NULL;

ALTER TABLE player
ADD COLUMN pending_email VARCHAR(255) NULL;

CREATE TABLE email_verification_token (
    id BIGSERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_verification_token_player_id_idx
    ON email_verification_token(player_id);

CREATE INDEX email_verification_token_expires_at_idx
    ON email_verification_token(expires_at);