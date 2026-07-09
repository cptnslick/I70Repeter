# I-70 Repeater Companion

GPS-aware, offline-capable web app for a one-day drive: **Baltimore, MD to
Westerville, OH** via I-70 W (Breezewood, PA Turnpike I-76 W, New Stanton,
I-70 W, Wheeling, Columbus, I-270 N). At any point on the drive it surfaces
the repeaters most likely to have someone listening, ranked by an activity
score, on a live map with a tap-for-details panel.

## Status

**MVP app shell is built and running against placeholder data.** The real
RepeaterBook export hasn't been dropped in yet — see [Data pipeline](#data-pipeline)
below. Until then, `src/data/repeaters.json` contains obviously-fake
`PLACEHOLDER` entries (a banner in the app says so) so the UI is fully
testable end to end.

## Stack

Vite + React + Leaflet (OSM tiles) + Tailwind CSS. Single-page, installable
PWA (offline app shell + repeaters.json via `vite-plugin-pwa`). No backend —
everything runs client-side against the static `repeaters.json`.

## Quick start

```
npm install
npm run dev       # local dev server
npm run build     # production build to dist/
npm run preview   # serve the production build
```

## Data pipeline

See [`data/README.md`](data/README.md) for the full flow. Short version:

1. Run a RepeaterBook highway/route search for I-70 (Baltimore MD ->
   Westerville OH) plus the I-76 PA Turnpike segment, export CSV, save to
   `data/raw/repeaterbook-export.csv`.
2. `node scripts/ingest.js --headers` to sanity-check column names, then
   `npm run ingest` to write `src/data/repeaters.json`.
3. Do the club-activity research pass and record findings in
   `data/research-overrides.json` (club site / Facebook / weekly nets /
   RepeaterBook verification / linked systems). Re-running `npm run ingest`
   merges overrides back in without losing research work.

Generate fresh placeholder PWA icons (only needed if you touch branding):

```
node scripts/gen-icons.mjs
```

## App architecture

- `src/data/route.js` — hardcoded I-70/I-76 corridor waypoints, densified
  into a polyline, with cumulative route-mile math.
- `src/lib/geo.js` — haversine distance, bearing, nearest-point-on-route.
- `src/lib/repeaters.js` — band range, scoring tiers, "nearby ahead"
  filtering, "next up" pick, net-time-now check.
- `src/hooks/useGeolocation.js` — `watchPosition`, throttled to ~5s,
  derives heading from successive fixes.
- `src/hooks/useSimMode.js` — dev toggle that animates a simulated GPS fix
  along the route polyline, for testing on a desk.
- `src/hooks/useWakeLock.js` — Screen Wake Lock toggle.
- `src/hooks/useOnlineStatus.js` — drives the map-vs-schematic fallback.
- `src/components/MapView.jsx` — Leaflet map, route line, GPS dot,
  score-colored/sized repeater markers, auto-follow + re-center.
- `src/components/SchematicView.jsx` — offline fallback: SVG route strip
  with repeater dots by route-mile, used when `navigator.onLine` is false
  (tiles you haven't already browsed won't load offline).
- `src/components/LowerPanel.jsx` + `RepeaterCard.jsx` + `RepeaterDetail.jsx`
  — slide-up panel: collapsed horizontal card scroller, expands to full
  detail (club, evidence, EchoLink/AllStar/IRLP, copy-freq button,
  RepeaterBook link).
- `src/components/NextUpStrip.jsx` — best-scored repeater coming into range
  in the next ~20 route miles.
- `src/components/SettingsSheet.jsx` — band filter, min-score slider, sim
  mode, wake lock.

The lower-panel list view works 100% offline (it's pure local data); only
the Leaflet basemap needs a network connection, and falls back to the
schematic view when offline.

## Deployment

Static site — deploy `dist/` to Netlify (or any static host). No
environment variables or backend required.

## Attribution

Repeater data courtesy of [RepeaterBook.com](https://www.repeaterbook.com/).
Each repeater detail panel links back to its RepeaterBook page. Per
RepeaterBook's policy, this dataset is for personal use and is not bulk
distributed.
