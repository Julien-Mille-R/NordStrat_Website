BEGIN;

CREATE TABLE IF NOT EXISTS table_guest (
  id SERIAL PRIMARY KEY,
  game_table_id INTEGER NOT NULL
    REFERENCES game_table(id)
    ON DELETE CASCADE,
  nickname VARCHAR(80) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS table_guest_game_table_nickname_key
  ON table_guest (game_table_id, nickname);

CREATE INDEX IF NOT EXISTS table_guest_game_table_id_idx
  ON table_guest (game_table_id);

COMMIT;