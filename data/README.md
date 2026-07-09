# Data pipeline

## 1. Drop the RepeaterBook exports

Run RepeaterBook's highway/route search for I-70 (Baltimore MD -> Westerville OH)
plus the I-76 PA Turnpike segment (Breezewood -> New Stanton), and export
**both** CSV and KML from the same search results:

```
data/raw/repeaterbook-export.csv
data/raw/repeaterbook-export.kml
```

Both are needed: the CSV carries County/State/Modes/tone data but has **no
coordinates**; the KML carries lat/lon, on-air status, and a stable
RepeaterBook detail-page ID but not the county/tone detail. `scripts/ingest.js`
joins them by (callsign, freq), disambiguating same-callsign+freq entries
(linked systems at two sites) by prefix-matching location text — the KML's
location field is sometimes a truncated version of the CSV's (e.g. `"Frederick"`
vs `"Frederick - Gambrill State Park"`).

Both raw exports are gitignored (`data/raw/*.csv`, `data/raw/*.kml`) —
RepeaterBook's personal-use policy doesn't cover redistributing the raw
export, so only the derived, scored `src/data/repeaters.json` is committed.

## 2. Run the ingest script

```
node scripts/ingest.js --headers   # sanity-check CSV column names against COLUMN_MAP
node scripts/ingest.js             # writes src/data/repeaters.json
```

Repeaters farther than `MAX_ROUTE_DIST_MILES` (15mi) from the route polyline
are dropped. That cutoff was tuned by inspecting a real export: it cleanly
separates legitimate corridor sites (mountaintop repeaters can sit several
miles off the direct highway line) from off-route noise near the endpoints
(e.g. DC-suburb repeaters near the Baltimore end of an "I-70" highway search).
Adjust it in `scripts/ingest.js` if a re-run drops something that should be
in range, or lets in something that shouldn't be.

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
evidence into that bonus. Only research the plausible candidates (proximity
to route + wide-coverage indicators like linked systems) — leave the rest at
the RepeaterBook-only baseline and note "unverified" rather than guessing.

## Known gap

The current export has no repeaters between Hagerstown, MD (route mile ~74)
and Connellsville, PA (route mile ~170) — the entire PA Turnpike segment
(Breezewood, Bedford, Somerset, Donegal, New Stanton) is uncovered. This
looks like a blind spot in the original route search rather than an actual
absence of repeaters there. Consider a supplemental RepeaterBook search
scoped to Bedford/Somerset/Westmoreland County, PA if that stretch matters
for the drive.
