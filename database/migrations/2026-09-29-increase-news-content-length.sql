BEGIN;

ALTER TABLE news_post
DROP CONSTRAINT IF EXISTS check_news_post_content_length;

ALTER TABLE news_post
ADD CONSTRAINT check_news_post_content_length
CHECK (CHAR_LENGTH(content) BETWEEN 20 AND 50000);

COMMIT;