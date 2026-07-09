# Data pipeline

## 1. Drop the RepeaterBook export

Run RepeaterBook's highway/route search for I-70 (Baltimore MD -> Westerville OH)
plus the I-76 PA Turnpike segment (Breezewood -> New Stanton), export CSV, and
save it to:

```
data/raw/repeaterbook-export.csv
```

## 2. Run the ingest script

```
node scripts/ingest.js --headers   # sanity-check column names against COLUMN_MAP
node scripts/ingest.js             # writes src/data/repeaters.json
```

## 3. Activity research pass

`data/research-overrides.json` holds manually/AI-researched club-activity
data, keyed by the repeater `id` that `scripts/ingest.js` assigns (see its
console output, or open `src/data/repeaters.json` after a first ingest run).
Re-running `node scripts/ingest.js` merges these overrides back in, so
research work is never lost on re-ingest.

Shape of each entry:

```json
{
  "rb-12345": {
    "club_name": "Central Ohio Radio Club",
    "club_url": "https://example.org",
    "evidence": ["Nightly traffic net 7:15pm", "Site updated 2026"],
    "net_times": [{ "dow": "daily", "time": "19:15", "tz": "America/New_York" }],
    "score_bonus": 65
  }
}
```

`score_bonus` is added on top of the deterministic RepeaterBook-only baseline
(last-verified recency + linked-system presence) that `scripts/ingest.js`
computes automatically, capped at 100 total. See the scoring rubric in the
project spec for how to weight club website / Facebook / net / trustee
evidence into that bonus.
