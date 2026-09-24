-- Reference schema and queries for the calibration-loop skill.
-- Written for DuckDB and tested there. Postgres differences are noted inline.

-- Every decision, as it was made. Log the raw probability, not just the
-- calibrated one: refitting needs what the model actually said.
CREATE TABLE IF NOT EXISTS decisions (
  item_id        VARCHAR   NOT NULL,
  question       VARCHAR   NOT NULL,   -- the question id
  definition_hash VARCHAR  NOT NULL,   -- hash of instructions/criteria: a reworded question is a new forecaster
  model_version  VARCHAR   NOT NULL,   -- pinned, never an alias like "latest"
  raw            DOUBLE    NOT NULL,   -- what the model reported
  p              DOUBLE    NOT NULL,   -- after the calibration table
  acted          BOOLEAN   NOT NULL,
  decided_at     TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, question)
);

-- What a person decided was true, per (item, question), and how the item got
-- to them. `weight` is 1 for acted-on items and 1/audit_rate for audit items.
CREATE TABLE IF NOT EXISTS labels (
  item_id      VARCHAR   NOT NULL,
  question     VARCHAR   NOT NULL,
  y            BOOLEAN   NOT NULL,
  reason       VARCHAR   NOT NULL CHECK (reason IN ('acted', 'audit')),
  weight       DOUBLE    NOT NULL,
  labelled_at  TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, question)
);

-- One row per question definition on one model version: the map from raw to honest.
CREATE TABLE IF NOT EXISTS calibration (
  question       VARCHAR   NOT NULL,
  definition_hash VARCHAR  NOT NULL,
  model_version  VARCHAR   NOT NULL,
  slope          DOUBLE,              -- yes/no questions (Platt)
  intercept      DOUBLE,
  temperature    DOUBLE,              -- choice questions (a first fix, not a general one)
  fitted_on      INTEGER   NOT NULL,  -- number of labels
  published_at   TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (question, definition_hash, model_version)
);

-- The review queue: everything acted on, plus a deterministic random audit of
-- everything. Set the audit rate with the literal below (0.03 here).
-- Postgres: replace hash(...) with abs(hashtext(...)).
CREATE OR REPLACE VIEW review_queue AS
SELECT d.*,
       CASE WHEN (hash(d.item_id || chr(0) || d.question) % 10000) / 10000.0 < 0.03
            THEN 'audit' ELSE 'acted' END AS reason,
       CASE WHEN (hash(d.item_id || chr(0) || d.question) % 10000) / 10000.0 < 0.03
            THEN 1 / 0.03 ELSE 1.0 END   AS weight
FROM decisions d
LEFT JOIN labels l USING (item_id, question)
WHERE l.item_id IS NULL
  AND (d.acted OR (hash(d.item_id || chr(0) || d.question) % 10000) / 10000.0 < 0.03);

-- Honesty per question, from the AUDIT rows only, because only they are a
-- random sample of all traffic. Reliability near 0 is honest; read it next to
-- resolution, never alone.
CREATE OR REPLACE VIEW reliability_by_question AS
WITH s AS (
  SELECT d.question, d.p, CASE WHEN l.y THEN 1.0 ELSE 0.0 END AS y, l.weight AS w
  FROM decisions d JOIN labels l USING (item_id, question)
  WHERE l.reason = 'audit'
),
base AS (SELECT question, sum(w * y) / sum(w) AS rate FROM s GROUP BY question),
b AS (
  SELECT question, least(9, floor(p * 10)) AS bucket,
         sum(w) AS w, sum(w * p) / sum(w) AS claimed, sum(w * y) / sum(w) AS happened
  FROM s GROUP BY question, bucket
)
SELECT b.question,
       sum(b.w)                                                   AS weighted_n,
       sum(b.w * abs(b.claimed - b.happened)) / sum(b.w)          AS ece,
       sum(b.w * (b.claimed - b.happened) ^ 2) / sum(b.w)         AS reliability,
       sum(b.w * (b.happened - base.rate) ^ 2) / sum(b.w)         AS resolution
FROM b JOIN base USING (question)
GROUP BY b.question;

-- Drift alarm, no labels: population stability index of raw probabilities,
-- last 7 days against the 28 days before that. Above 0.25, investigate and
-- pull fresh labels forward. It can't see calibration decay that leaves the
-- score histogram unchanged; reliability_by_question on audit rows can.
-- Postgres: replace least(9, floor(...)) with least(9, floor(...))::int and
-- now() - INTERVAL '7 days' works the same.
CREATE OR REPLACE VIEW drift_by_question AS
WITH tagged AS (
  SELECT question, least(9, floor(raw * 10)) AS bucket,
         CASE WHEN decided_at >= now() - INTERVAL 7 DAY THEN 'now' ELSE 'base' END AS period
  FROM decisions
  WHERE decided_at >= now() - INTERVAL 35 DAY
),
counts AS (
  SELECT question, bucket,
         count(*) FILTER (WHERE period = 'base') + 0.5 AS nb,
         count(*) FILTER (WHERE period = 'now')  + 0.5 AS nn
  FROM tagged GROUP BY question, bucket
),
shares AS (
  SELECT question, bucket,
         nb / sum(nb) OVER (PARTITION BY question) AS pb,
         nn / sum(nn) OVER (PARTITION BY question) AS pn
  FROM counts
)
SELECT question, sum((pn - pb) * ln(pn / pb)) AS psi
FROM shares GROUP BY question;
