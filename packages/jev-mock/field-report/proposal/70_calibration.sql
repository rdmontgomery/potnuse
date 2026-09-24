-- ─────────────────────────────────────────────────────────────────────────────
-- L3: close the loop.
--
-- Everything up to here turns values into probabilities. This layer answers the
-- question that follows: is a probability from THIS probe on YOUR data worth
-- what it says, and what should you compare it against?
--
-- No API calls, no Rust, no new dependencies. The whole of it is aggregation
-- over a table of human dispositions that you accumulate as people work.
--
-- Three things live here:
--   sem_costs / sem_thresholds   what a miss is worth, per probe. No labels.
--   sem_calibrate                per-probe honesty, from labels.
--   sem_probe_health             which of your probes are badly worded.
--   sem_label_queue              what to send for review, without the bias.
--   sem_drift                    when to go and look again. No labels.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── what a miss costs, per probe ─────────────────────────────────────────────
--
-- One number: how many false flags you would accept to avoid one miss. A person
-- dismissing a wrong flag costs ~10 seconds. A national ID sitting in a notes
-- field for a year costs rather more. These are defaults to argue with, not
-- measurements -- override by wrapping this macro the way sem_catalog() is
-- overridden.

CREATE OR REPLACE MACRO sem_costs() AS TABLE
SELECT * FROM (VALUES
    ('credential_exposed',             500),
    ('embedded_pii',                   200),
    ('sentinel_used_as_value',          40),
    ('geo_inconsistent',                30),
    ('status_timeline_inconsistent',    30),
    ('unit_ambiguous',                  30),
    ('impossible_for_domain',           25),
    ('quantity_amount_mismatch',        25),
    ('type_mismatch',                   20),
    ('internally_contradictory',        20),
    ('multiple_values_in_one_field',    15),
    ('row_is_test_data',                15),
    ('placeholder_or_test_value',       15),
    ('category_product_mismatch',       10),
    ('operational_note_in_data_field',  10),
    ('internal_code_leaked',            10),
    ('truncated_value',                 10),
    ('wrong_granularity',                8),
    ('language_mismatch',                5),
    ('mojibake',                         5)
) AS t(probe_id, misses_per_false_flag);

-- The cost-optimal cutoff is cost(false flag) / (cost(false flag) + cost(miss)),
-- which with the ratio above is 1 / (1 + m).
--
-- IMPORTANT, and the reason this macro is not the end of the story: that formula
-- assumes the probability is honest. Applied to a raw stream it can be wildly
-- wrong -- on a recorded corpus of real Jev judgments it landed 7x worse than
-- the best achievable cutoff, because the model's mid-range is far less
-- trustworthy than its extremes. Calibrate first; sem_calibrate() below says
-- whether a probe has earned its cost threshold yet.
CREATE OR REPLACE MACRO sem_thresholds() AS TABLE
    SELECT probe_id,
           misses_per_false_flag,
           round(1.0 / (1 + misses_per_false_flag), 4) AS cost_threshold
    FROM sem_costs();

-- ── the disposition log ──────────────────────────────────────────────────────
--
-- The user owns this table; the extension only reads it. Create it once:
--
--   CREATE TABLE sem_dispositions (
--     profiled_table  VARCHAR,
--     row_id          BIGINT,
--     probe_id        VARCHAR,
--     column_name     VARCHAR,          -- NULL for row-scope probes
--     probability     DOUBLE,           -- what the model said, at review time
--     was_a_defect    BOOLEAN,          -- what the reviewer decided
--     sampling_weight DOUBLE DEFAULT 1, -- see sem_label_queue()
--     reviewed_at     TIMESTAMP DEFAULT now(),
--     reviewer        VARCHAR,
--     model_version   VARCHAR
--   );
--
-- The granularity is the point. A reviewer is not dismissing "row 47", they are
-- dismissing "row 47, flagged for geo_inconsistent". Logging the verdict per
-- row loses the only thing that makes any of the rest of this possible, and it
-- is not recoverable afterwards.

-- ── per-probe calibration ────────────────────────────────────────────────────
--
-- sampling_weight carries the inverse-propensity correction from
-- sem_label_queue(). Reviewing only what you flagged tells you about precision
-- forever and about recall never, so the weights are load-bearing: without them
-- every number below is conditioned on having been flagged.

CREATE OR REPLACE MACRO sem_scored(labels, tbl := NULL) AS TABLE
    SELECT probe_id,
           probability AS p,
           CASE WHEN was_a_defect THEN 1.0 ELSE 0.0 END AS y,
           coalesce(sampling_weight, 1.0) AS w
    FROM query_table(labels)
    WHERE probability IS NOT NULL
      AND was_a_defect IS NOT NULL
      AND (tbl IS NULL OR profiled_table = tbl);

-- Ten equal-width buckets: what the probe claimed against what happened.
CREATE OR REPLACE MACRO sem_reliability(labels, probe := NULL, tbl := NULL) AS TABLE
    WITH s AS (SELECT * FROM sem_scored(labels, tbl) WHERE probe IS NULL OR probe_id = probe),
    b AS (
        SELECT probe_id,
               least(9, floor(p * 10))::INT AS bucket,
               sum(w)                       AS n,
               sum(w * p) / sum(w)          AS claimed,
               sum(w * y) / sum(w)          AS happened
        FROM s GROUP BY 1, 2
    )
    SELECT probe_id, bucket / 10.0 AS bucket_lo, round(n) AS n,
           round(claimed, 3) AS claimed, round(happened, 3) AS happened,
           -- Wilson interval, so nobody reads a shape into 4 observations.
           -- z^2/(2n) = 1.92/n, and the whole thing clamped: a proportion
           -- interval that reports -0.06 is a formula error, not a finding.
           greatest(0, round((happened + 1.92/n - 1.96 * sqrt(happened*(1-happened)/n + 0.96/n/n)) / (1 + 3.84/n), 3)) AS lo,
           least(1,  round((happened + 1.92/n + 1.96 * sqrt(happened*(1-happened)/n + 0.96/n/n)) / (1 + 3.84/n), 3)) AS hi
    FROM b ORDER BY probe_id, bucket_lo;

-- The headline per probe: is this number honest, is it informative, and what
-- cutoff should you actually use.
CREATE OR REPLACE MACRO sem_calibrate(labels, tbl := NULL, shrinkage := 8.0) AS TABLE
    WITH s AS (SELECT * FROM sem_scored(labels, tbl)),
    base AS (SELECT sum(w * y) / sum(w) AS rate FROM s),
    -- Murphy's decomposition, bucketed: reliability is dishonesty, resolution is
    -- informativeness. They move independently and must be read together.
    bins AS (
        SELECT probe_id, least(9, floor(p * 10))::INT AS bucket,
               sum(w) AS n, sum(w * p) / sum(w) AS claimed, sum(w * y) / sum(w) AS happened
        FROM s GROUP BY 1, 2
    ),
    decomp AS (
        SELECT b.probe_id,
               sum(b.n)                                            AS n,
               sum(b.n * abs(b.claimed - b.happened)) / sum(b.n)    AS ece,
               sum(b.n * (b.claimed - b.happened)^2) / sum(b.n)     AS reliability,
               sum(b.n * (b.happened - base.rate)^2) / sum(b.n)     AS resolution
        FROM bins b, base GROUP BY 1
    ),
    pos AS (
        SELECT probe_id, sum(w * y) AS positives,
               min(CASE WHEN y = 1 THEN p END) AS lowest_defect,
               max(CASE WHEN y = 0 THEN p END) AS highest_false_alarm
        FROM s GROUP BY 1
    ),
    -- The empirical cost-minimizing cutoff, swept per probe. A sweep is a join.
    grid AS (SELECT unnest(generate_series(0, 100)) / 100.0 AS t),
    swept AS (
        SELECT s.probe_id, g.t,
               sum(s.w * CASE WHEN s.p >= g.t AND s.y = 0 THEN 1
                              WHEN s.p <  g.t AND s.y = 1 THEN c.misses_per_false_flag
                              ELSE 0 END) AS cost
        FROM s
        JOIN sem_costs() c USING (probe_id)
        CROSS JOIN grid g
        GROUP BY 1, 2
    ),
    fitted AS (
        SELECT probe_id, min_by(t, cost) AS fitted_threshold FROM swept GROUP BY 1
    ),
    -- Pooled fallback for probes with too few positives to fit anything.
    pooled AS (SELECT median(fitted_threshold) AS t FROM fitted)
    SELECT d.probe_id,
           round(d.n)                                  AS judgments,
           round(p.positives, 1)                       AS defects,
           round(d.ece, 4)                             AS ece,
           round(d.reliability, 5)                     AS reliability,
           round(d.resolution, 4)                      AS resolution,
           round(p.lowest_defect - p.highest_false_alarm, 3) AS separation,
           t.cost_threshold,
           f.fitted_threshold,
           -- James-Stein, on the scarce resource: a probe earns its own cutoff in
           -- proportion to how many DEFECTS it has seen, not how many rows. With
           -- two positives you get the pool; with fifty you get your own.
           round((p.positives / (p.positives + shrinkage)) * f.fitted_threshold
                 + (shrinkage / (p.positives + shrinkage)) * pooled.t, 3) AS shrunk_threshold,
           CASE WHEN p.positives < 10 THEN 'too few defects to judge'
                WHEN d.reliability <= 0.01 THEN 'calibrated: use cost_threshold'
                ELSE 'not calibrated: use shrunk_threshold' END AS basis
    FROM decomp d
    JOIN pos p USING (probe_id)
    JOIN fitted f USING (probe_id)
    LEFT JOIN sem_thresholds() t USING (probe_id), pooled
    ORDER BY d.reliability DESC;

-- ── the diagnostic that reads the catalog, not the data ──────────────────────
--
-- A probe whose calibration is far off the pool is usually not a model failure.
-- It is a question that was worded badly, and this is how you find out which.

CREATE OR REPLACE MACRO sem_probe_health(labels, tbl := NULL) AS TABLE
    WITH c AS (SELECT * FROM sem_calibrate(labels, tbl)),
    pool AS (SELECT median(reliability) AS typical FROM c WHERE defects >= 2)
    SELECT probe_id, judgments, defects, reliability, separation,
           CASE
             WHEN defects < 2 THEN 'no verdict: needs labelled defects'
             WHEN separation <= 0 THEN 'INVERTED: clean values outrank real defects. Read the instructions -- the probe is probably firing on a case its applies_to should exclude.'
             WHEN reliability > 10 * pool.typical THEN 'SUSPECT WORDING: far less honest than its peers on the same data. Usually a true criterion that is broader than the defect it names.'
             WHEN separation < 0.2 THEN 'WEAK: separates, but with no margin. A small distribution shift will start costing you.'
             ELSE 'healthy'
           END AS verdict
    FROM c, pool ORDER BY separation;

-- ── closing the loop ─────────────────────────────────────────────────────────
--
-- What to put in front of a person. Everything above the cutoff, PLUS a small
-- random sample from below it.
--
-- That second part is the whole trick. Review only what you flagged and you
-- learn precision forever and recall never -- and the failure that actually
-- hurts, a cutoff drifting up while defects slip under it, is exactly the one
-- you have made yourself blind to. The audit rows carry sampling_weight =
-- 1/audit_rate so they weigh back up to the population they stand for.

CREATE OR REPLACE MACRO sem_label_queue(
    tbl, threshold := 0.7, audit_rate := 0.03, rows := 100, n := 200
) AS TABLE
    WITH v AS (SELECT * FROM sem_values(tbl, rows, n))
    SELECT tbl AS profiled_table, row_id, probe_id, column_name, probability,
           'flagged' AS reason, 1.0 AS sampling_weight, value
    FROM v WHERE probability >= threshold
    UNION ALL
    SELECT tbl, row_id, probe_id, column_name, probability,
           'audit' AS reason, 1.0 / audit_rate AS sampling_weight, value
    FROM v
    WHERE probability < threshold
      -- Deterministic and reproducible: hash the identity, not a random draw.
      AND (hash(tbl || row_id::VARCHAR || probe_id || coalesce(column_name, '')) % 10000) / 10000.0 < audit_rate
    ORDER BY probability DESC;

-- ── when to go and look again ────────────────────────────────────────────────
--
-- Labels are expensive and drift is rare, so do not spend the former waiting
-- for the latter. This needs no labels at all: it watches the shape of the
-- probabilities against the run you calibrated on. A model version bump or a
-- schema change moves it immediately, and then you spend the audit budget.
--
-- Population stability index. Under 0.1 is quiet, 0.1-0.25 is worth a look,
-- above 0.25 means recalibrate.

CREATE OR REPLACE MACRO sem_drift(current_labels, baseline_labels) AS TABLE
    WITH a AS (
        SELECT probe_id, least(9, floor(probability * 10))::INT AS bucket, count(*) AS n
        FROM query_table(baseline_labels) WHERE probability IS NOT NULL GROUP BY 1, 2
    ),
    b AS (
        SELECT probe_id, least(9, floor(probability * 10))::INT AS bucket, count(*) AS n
        FROM query_table(current_labels) WHERE probability IS NOT NULL GROUP BY 1, 2
    ),
    base_totals AS (SELECT probe_id, sum(n) AS total FROM a GROUP BY 1),
    now_totals AS (SELECT probe_id, sum(n) AS total FROM b GROUP BY 1),
    j AS (
        SELECT coalesce(a.probe_id, b.probe_id) AS probe_id,
               coalesce(a.bucket, b.bucket) AS bucket,
               -- Laplace, so an empty bucket does not divide by zero.
               (coalesce(a.n, 0) + 0.5) / (base_totals.total + 5) AS p_base,
               (coalesce(b.n, 0) + 0.5) / (now_totals.total + 5) AS p_now
        FROM a FULL OUTER JOIN b USING (probe_id, bucket)
        JOIN base_totals ON base_totals.probe_id = coalesce(a.probe_id, b.probe_id)
        JOIN now_totals ON now_totals.probe_id = coalesce(a.probe_id, b.probe_id)
    )
    SELECT probe_id,
           round(sum((p_now - p_base) * ln(p_now / p_base)), 4) AS psi,
           CASE WHEN sum((p_now - p_base) * ln(p_now / p_base)) > 0.25 THEN 'recalibrate'
                WHEN sum((p_now - p_base) * ln(p_now / p_base)) > 0.10 THEN 'watch'
                ELSE 'stable' END AS verdict
    FROM j GROUP BY 1 ORDER BY psi DESC;
