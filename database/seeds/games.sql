INSERT INTO game (
    name,
    universe,
    description,
    min_players,
    max_players,
    image_url,
    is_available,
    created_at,
    updated_at
) VALUES
    ('Deepsyx', 'Fantastique', NULL, 2, 6, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Frostgrave', 'Fantasy', NULL, 2, 4, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Marvel Crisis Protocol', NULL, NULL, NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Rangers Of Shadow Deep', NULL, NULL, NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Star Wars Legion', 'Star Wars', NULL, 2, 4, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Stargrave', NULL, NULL, NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Warhammer 40000', 'Warhammer', NULL, 2, 6, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Warhammer Age Of Sigmar', NULL, NULL, NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Warhammer The Old World', 'Warhammer', NULL, 2, 6, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (LOWER(name)) DO UPDATE SET
    universe = EXCLUDED.universe,
    description = EXCLUDED.description,
    min_players = EXCLUDED.min_players,
    max_players = EXCLUDED.max_players,
    image_url = COALESCE(game.image_url, EXCLUDED.image_url),
    is_available = EXCLUDED.is_available,
    updated_at = CURRENT_TIMESTAMP;
