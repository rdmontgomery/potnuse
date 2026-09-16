-- Responses from public price aggregators, successes and refusals alike.
--
-- Shared by the cron and by the diagnostics page so they spend one budget
-- rather than two. Keyed by URL because that is exactly the granularity the
-- upstream rate-limits at.

CREATE TABLE IF NOT EXISTS http_cache (
  url         TEXT PRIMARY KEY,
  body        TEXT NOT NULL,
  status      INTEGER NOT NULL,
  stored_at   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS http_cache_expires ON http_cache (expires_at);
