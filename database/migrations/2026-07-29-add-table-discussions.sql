BEGIN;

CREATE TABLE IF NOT EXISTS table_comment (
  id SERIAL PRIMARY KEY,
  game_table_id INTEGER NOT NULL REFERENCES game_table(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_comment_table_created
  ON table_comment(game_table_id, created_at);

CREATE INDEX IF NOT EXISTS idx_table_comment_player
  ON table_comment(player_id);

CREATE TABLE IF NOT EXISTS table_discussion_read (
  game_table_id INTEGER NOT NULL REFERENCES game_table(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_table_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_table_discussion_read_player
  ON table_discussion_read(player_id);

COMMIT;
