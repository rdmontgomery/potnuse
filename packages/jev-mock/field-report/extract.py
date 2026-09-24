"""
Turn Patrick's recorded Jev responses into (forecast, outcome) pairs.

Input:  test/fixtures/shipments_cache.jsonl  — 77 real Jev responses
        demo/messy.sql                        — ground truth, in its header comment
        src/sql/30_catalog.sql                — probe_id -> instruction template

Output: pairs.json, plus a retest file for the rows that were asked twice.

Labelling rule: messy.sql enumerates every planted defect. A (row, probe) is
positive when that comment block names it and negative otherwise. That rule is
only safe where the defect class is fully enumerated, so probes are split into
tiers and scored separately rather than pooled.
"""
import json, re, sys, collections, pathlib

REPO = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '../duckdb-semantic-profile')
OUT = pathlib.Path(__file__).parent

# --- probe_id -> regex over the instruction text -----------------------------

def catalog():
    src = (REPO / 'src/sql/30_catalog.sql').read_text()
    out = {}
    for pid, scope, instr in re.findall(
        r"\('([a-z_]+)',\s*'(value|row)',\s*\[[^\]]*\],\s*(?:true|false),\s*\n\s*'((?:[^']|'')+)'", src):
        instr = instr.replace("''", "'")
        # {col} can appear twice in one template, so only the first capture is
        # named; the rest become plain groups.
        pat = re.escape(instr).replace(r'\{type\}', r'.+?')
        first = [True]
        def sub(_m):
            if first[0]:
                first[0] = False
                return r'(?P<col>[A-Za-z0-9_]+)'
            return r'(?P=col)'
        pat = re.sub(r'\\\{col\\\}', sub, pat)
        out[pid] = (scope, re.compile('^' + pat + '$'))
    return out

CAT = catalog()

def identify(instructions):
    for pid, (scope, pat) in CAT.items():
        m = pat.match(instructions)
        if m:
            return pid, scope, (m.groupdict().get('col') if scope == 'value' else None)
    return None, None, None

# --- ground truth ------------------------------------------------------------
#
# Transcribed from the header of demo/messy.sql. Row-scope entries are complete:
# the comment enumerates every planted row-level defect, so every other row is a
# true negative. Value-scope entries name the exact cell.

ROW_TRUTH = {
    'row_is_test_data':             {3, 17},
    'geo_inconsistent':             {5, 12},
    'status_timeline_inconsistent': {7, 15},
    'category_product_mismatch':    {6},
    'quantity_amount_mismatch':     set(),
    'internally_contradictory':     set(),   # see NOTE below
}

# Value-scope, keyed (probe_id, column) -> set of row ids.
VALUE_TRUTH = {
    ('embedded_pii', 'notes'):                        {9},
    ('multiple_values_in_one_field', 'email'):        {8},
    ('unit_ambiguous', 'weight'):                     {2, 11},
    ('operational_note_in_data_field', 'address'):    {14},
    ('mojibake', 'customer'):                         {20},
    ('mojibake', 'notes'):                            {20},
}

# Tier A: the negative class is trustworthy because messy.sql enumerates the
# class exhaustively and the defect is visually unambiguous.
TIER_A_ROW = {'row_is_test_data', 'geo_inconsistent', 'status_timeline_inconsistent',
              'category_product_mismatch'}
TIER_A_VALUE = {'embedded_pii', 'multiple_values_in_one_field', 'unit_ambiguous',
                'operational_note_in_data_field', 'mojibake'}

# Tier B: scored but flagged. 'internally_contradictory' is explicitly a
# catch-all ("setting aside anything already covered"), so a row carrying any
# other planted defect may legitimately trip it — the negative class is unsafe.
# 'quantity_amount_mismatch' has no planted positive at all, so it measures the
# false-positive rate only. 'sentinel_used_as_value' is excluded entirely:
# shipped_at='' on rows 7/14/15 and notes='none' throughout are arguably
# sentinels that messy.sql does not count, which would make honest model
# answers score as errors.
TIER_B_ROW = {'quantity_amount_mismatch', 'internally_contradictory'}

# --- extract -----------------------------------------------------------------

recs = [json.loads(l) for l in (REPO / 'test/fixtures/shipments_cache.jsonl').open()]

def load(x):
    return json.loads(x) if isinstance(x, str) else x

observations = []           # every labelled judgment
retest = collections.defaultdict(list)   # (row, probe, col) -> [p, p]
unmatched = collections.Counter()

for rec in recs:
    state = load(rec['state'])
    if not (isinstance(state, dict) and 'row' in state):
        continue                       # discovery/selection requests: no row truth
    row_id = state['row']['id']
    questions = load(rec['questions'])
    answers = load(rec['response']).get('answers', {})

    for qid, q in questions.items():
        ans = answers.get(qid)
        if not isinstance(ans, dict) or ans.get('type') != 'noul':
            continue
        p = ans.get('noul')
        if not isinstance(p, (int, float)):
            continue
        pid, scope, col = identify(q['instructions'])
        if pid is None:
            unmatched[q['instructions'][:60]] += 1
            continue

        if scope == 'row':
            if pid not in ROW_TRUTH:
                continue
            y = 1 if row_id in ROW_TRUTH[pid] else 0
            tier = 'A' if pid in TIER_A_ROW else 'B'
        else:
            if pid not in TIER_A_VALUE:
                continue                # only value probes with a safe negative class
            key = (pid, col)
            if key in VALUE_TRUTH:
                y = 1 if row_id in VALUE_TRUTH[key] else 0
            else:
                # Same probe on a column with no planted defect of that kind.
                y = 0
            tier = 'A'

        observations.append({'row': row_id, 'probe': pid, 'scope': scope,
                             'column': col, 'p': p, 'y': y, 'tier': tier})
        retest[(row_id, pid, col)].append(p)

(OUT / 'pairs.json').write_text(json.dumps(observations))
(OUT / 'retest.json').write_text(
    json.dumps([v for v in retest.values() if len(v) == 2]))

print('labelled judgments:', len(observations))
print('  tier A:', sum(1 for o in observations if o['tier'] == 'A'))
print('  tier B:', sum(1 for o in observations if o['tier'] == 'B'))
print('  positives:', sum(o['y'] for o in observations))
print('probes covered:', len({o['probe'] for o in observations}))
print('retest pairs:', sum(1 for v in retest.values() if len(v) == 2))
if unmatched:
    print('unmatched instruction templates:', len(unmatched))
    for k, v in unmatched.most_common(5): print('   ', v, k)
