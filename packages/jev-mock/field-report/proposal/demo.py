"""Runs 70_calibration.sql against the real Jev judgments in pairs.json."""
import duckdb, json, pathlib, re
HERE = pathlib.Path(__file__).parent
con = duckdb.connect()

obs = json.loads((HERE.parent / 'pairs.json').read_text())
con.execute("""CREATE TABLE sem_dispositions (
  profiled_table VARCHAR, row_id BIGINT, probe_id VARCHAR, column_name VARCHAR,
  probability DOUBLE, was_a_defect BOOLEAN, sampling_weight DOUBLE,
  reviewed_at TIMESTAMP, reviewer VARCHAR, model_version VARCHAR)""")
con.executemany("INSERT INTO sem_dispositions VALUES ('shipments',?,?,?,?,?,1.0,now(),'fixture','jev-latest')",
                [(o['row'], o['probe'], o['column'], o['p'], bool(o['y'])) for o in obs if o['tier'] == 'A'])

sql = (HERE / '70_calibration.sql').read_text()
# Split on macro boundaries; skip sem_label_queue, which needs the extension's
# own sem_values() layer and so cannot run standalone.
chunks = re.split(r'(?=CREATE OR REPLACE MACRO)', sql)
for chunk in chunks:
    if 'CREATE OR REPLACE MACRO' not in chunk or 'MACRO sem_label_queue' in chunk:
        continue
    con.execute(chunk[:chunk.rindex(';') + 1])

def show(title, q):
    print(f"\n=== {title} ===")
    print(con.sql(q))

show("sem_calibrate('sem_dispositions')  — per-probe honesty and the cutoff to use",
     "SELECT probe_id, judgments, defects, ece, reliability, separation, cost_threshold, fitted_threshold, shrunk_threshold, basis FROM sem_calibrate('sem_dispositions')")
show("sem_probe_health('sem_dispositions')  — the diagnostic for the catalog",
     "SELECT probe_id, defects, reliability, separation, verdict FROM sem_probe_health('sem_dispositions')")
show("sem_thresholds()  — from declared cost alone, no labels",
     "SELECT * FROM sem_thresholds() WHERE probe_id IN ('embedded_pii','mojibake','geo_inconsistent','row_is_test_data')")
show("sem_reliability('sem_dispositions', probe := 'row_is_test_data')",
     "SELECT bucket_lo, n, claimed, happened, lo, hi FROM sem_reliability('sem_dispositions', probe := 'row_is_test_data')")

# Drift: the same corpus against a deliberately sharpened copy, to show the
# tripwire firing without any labels at all.
# Clamp rather than filter: dropping rows would change the bucket counts and
# inflate the PSI on its own, which would be measuring the demo, not the drift.
con.execute("""CREATE TABLE drifted AS
  SELECT * REPLACE (
    1/(1+exp(-(ln(least(0.999, greatest(0.001, probability))
                  /(1-least(0.999, greatest(0.001, probability))))/0.5))) AS probability)
  FROM sem_dispositions""")
show("sem_drift('drifted', 'sem_dispositions')  — label-free tripwire",
     "SELECT * FROM sem_drift('drifted','sem_dispositions') LIMIT 6")
