
-- Migration : catégories, visibilité et galerie des actualités
-- Compatible avec les news existantes : visibles par défaut.
-- Ne pas modifier ce fichier après son application.

BEGIN;

-- 1. Visibilité et catégorie de chaque actualité.
ALTER TABLE news_post
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE news_post
  ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'accueil';

-- Les trois seules catégories autorisées.
ALTER TABLE news_post
  ADD CONSTRAINT news_post_category_check
  CHECK (category IN ('accueil', 'actualites', 'assaut_bruay'));

-- 2. Galerie : une actualité peut avoir plusieurs photos.
CREATE TABLE IF NOT EXISTS news_post_image (
  id SERIAL PRIMARY KEY,
  news_post_id INTEGER NOT NULL
    REFERENCES news_post(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Index pour les pages publiques et l'ordre des photos.
CREATE INDEX IF NOT EXISTS idx_news_post_visibility_category_date
  ON news_post (is_visible, category, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_post_image_post_order
  ON news_post_image (news_post_id, display_order, id);

COMMIT;
