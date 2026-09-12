-- Tape runner schema.
--
-- Block numbers are TEXT, not INTEGER: they are bigints, and a chain producing
-- a block every 100ms outruns a JS number sooner than anyone expects. Amounts
-- inside journal and state blobs are already encoded by the shared codec.

CREATE TABLE IF NOT EXISTS markets (
  id          TEXT PRIMARY KEY,
  config      TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cursors (
  market_id   TEXT PRIMARY KEY,
  block       TEXT NOT NULL
);

-- Program-wide, not per market: the budget ceiling and the post-loss cooldown
-- both span markets.
CREATE TABLE IF NOT EXISTS bankroll (
  program_id  TEXT PRIMARY KEY,
  state       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  market_id   TEXT PRIMARY KEY,
  state       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS journal (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id   TEXT,
  t           INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  event       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS journal_market_t ON journal (market_id, t);
CREATE INDEX IF NOT EXISTS journal_kind ON journal (kind);

CREATE TABLE IF NOT EXISTS runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER NOT NULL,
  markets       INTEGER NOT NULL,
  observations  INTEGER NOT NULL,
  error         TEXT
);
