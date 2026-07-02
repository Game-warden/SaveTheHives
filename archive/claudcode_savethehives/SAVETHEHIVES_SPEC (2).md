# SaveTheHives — Project Specification & Design Document

**Presenter:** Ronnie Bouchon  
**Document Version:** v1.0  
**Last Updated:** June 2026  
**Purpose:** Living reference for the SaveTheHives PWA — feature set, design system, tech stack, and roadmap.

> **How to keep this current:** Ask Claude to "update the spec doc" at any milestone and a fresh version will be generated reflecting current state. The HTML file also contains an inline `<!-- SPEC -->` comment block at the top that acts as a quick-reference changelog that always travels with the code.

---

## 1. Project Overview

SaveTheHives is a citizen science Progressive Web App for mapping feral honeybee colonies worldwide. It serves field researchers, beekeepers, Scout troops, and the general public — allowing anyone to log, find, and study wild hive locations.

The core scientific purpose is tracking **colony resilience**: feral hives that survive 3+ winters without treatment are genetic goldmines for Varroa-resistance research.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| App shell | Single-file HTML PWA | No build step; works locally and hosted |
| Map engine | Leaflet 1.9.4 | Open source, handles 10K+ markers |
| Tile layer | CartoDB Positron | Light grey/clean, worldwide coverage |
| Clustering | Leaflet.MarkerCluster 1.5.3 | Auto-clusters dense pin areas |
| Geocoding | photon.komoot.io (primary) | CORS-safe, worldwide, no API key |
| Geocoding fallback | Nominatim / OpenStreetMap | Used if photon fails |
| Storage (Phase 1) | localStorage | Offline-capable, no backend needed |
| Storage (Phase 2+) | Firebase or Supabase | Planned; choose at backend milestone |
| Font | Outfit (Google Fonts) | Variable weight, modern sans-serif |
| Icons | Inline SVG | No external icon library dependency |
| PWA manifest | Inline blob URL (local) | Replace with real file when hosted |
| Service worker | Not yet implemented | Defer until data architecture finalized |

---

## 3. Design System

### Color Palette
| Token | Value | Usage |
|---|---|---|
| `--honey` | `#f5a623` | Primary accent, active states, headings |
| `--honey-dark` | `#c8821a` | Hover states |
| `--honey-light` | `#ffd166` | Highlight |
| `--bg` | `#0f0d07` | Page background |
| `--surface` | `rgba(28,26,16,0.92)` | Card/panel backgrounds |
| `--text` | `#f0e8d0` | Primary text |
| `--text-muted` | `#9a8d6a` | Secondary text, labels |

### Pin Colors by Type
| Type | Color |
|---|---|
| Live Tree | `#4caf50` (green) |
| Dead Tree | `#795548` (brown) |
| Man Made | `#2196f3` (blue) |
| Ground | `#ff9800` (orange) |

### Elevation (Shadow System)
- `--shadow-sm` — subtle lift, used on pills, inputs
- `--shadow-md` — cards, FABs, dropdowns
- `--shadow-lg` — modals, toasts, popups

No hard borders. All separation is achieved through shadow and background opacity.

### Border Radius
- `--radius-sm` — 10px (inputs, small cards)
- `--radius-md` — 14px (cards, modals, popups)
- `--radius-lg` — 20px (bottom sheet rounded top)
- `--radius-pill` — 999px (pills, FABs, toasts)

### Typography
- **Font:** Outfit (Google Fonts, variable weight)
- **Sizing:** `clamp()` fluid scaling throughout — no fixed breakpoint font jumps
- **Line height:** 1.6 for body text
- **Hierarchy:** 700 bold headings → 600 labels → 400 body → 300 captions

### Glassmorphism Surfaces
Applied to: header, bottom navigation, modals, map popups, FABs, radius toggle, toast.  
Pattern: `backdrop-filter: blur(16px)` + semi-transparent background + no border (shadow instead).

### PWA / Mobile Standards
- **Safe area insets:** `env(safe-area-inset-top/bottom)` on header and bottom nav
- **Touch targets:** Minimum 44×44px on all interactive elements
- **Micro-interactions:** `scale(0.96)` on press, hover lift on cards/buttons
- **Viewport:** `viewport-fit=cover` for edge-to-edge on iPhone

---

## 4. Data Model

### Hive Record
```json
{
  "id": 460,
  "name": "Ronnie Bouchon",
  "lat": 35.951496,
  "lng": -78.692795,
  "type": "Man Made",
  "description": "Roseington swarm N. Raleigh...",
  "city": "Raleigh",
  "state": "NC",
  "zip": "27613",
  "year": 2012,
  "userAdded": true
}
```

### Hive Types
| Type | Emoji | Description |
|---|---|---|
| Live Tree | 🌳 | Active colony in living wood |
| Dead Tree | 🪵 | Colony in snag or fallen timber |
| Man Made | 🏠 | Building void, wall, managed hive, apiary |
| Ground | 🌿 | Subterranean or ground-level nest |

### Legacy Dataset
- **Source:** `honeybee1.sql` (phpMyAdmin export, 2017)
- **Records:** 1,152 valid hive records (10 skipped — invalid coordinates)
- **Date range:** 2008–2017
- **Geographic coverage:** Primarily North America + Puerto Rico + small international set
- **Mating radius:** 4,828m (3 miles) per pin

---

## 5. Feature Set

### Phase 1 — Core Map MVP ✅ Complete

| Feature | Status | Notes |
|---|---|---|
| PWA shell (installable) | ✅ | Manifest placeholder; full manifest post-hosting |
| Interactive map + clustering | ✅ | Handles 10K+ pins smoothly |
| 1,152 legacy hive records | ✅ | Seeded from SQL, normalized to 4 types |
| Color-coded pin markers | ✅ | SVG pins by type |
| Filter pills by type | ✅ | Respects keyword search simultaneously |
| 3-mile mating radius overlay | ✅ | Global toggle + per-pin from popup |
| Geographic search | ✅ | Nominatim, city/landmark/address — worldwide; ZIP dropped (unreliable globally) |
| Notes/keyword full-text search | ✅ | Searches name, description, city, state; equal-width with location bar |
| Responsive search bars | ✅ | True flex parity — equal width at all breakpoints |
| Map crosshair + live coords | ✅ | Pan to location → coords auto-fill Add Hive |
| Add Hive form | ✅ | GPS override or crosshair capture |
| Date stamps | ✅ | Full date (not just year) on every record, legacy + user-added |
| Scrollable hive notes | ✅ | Popups scroll instead of clipping long descriptions |
| Records list panel + fly-to | ✅ | First 50 shown; use search to narrow |
| About panel + legend | ✅ | Bee header photo + type legend |
| LocalStorage persistence | ✅ | User-added hives survive page refresh |

---

### Phase 2 — Pathfinder Beelining Tool ✅ Complete

The signature field research feature. Uses live phone sensors to triangulate a feral colony's location from two bee-line bearings — guiding a novice citizen scientist the way a veteran bee hunter would.

| Feature | Status | Notes |
|---|---|---|
| Live compass heading | ✅ | `DeviceOrientationEvent` — `webkitCompassHeading` on iOS, `alpha` fallback on Android |
| iOS permission flow | ✅ | `DeviceOrientationEvent.requestPermission()` triggered by user tap |
| Manual bearing fallback | ✅ | Numeric entry (0–359°) if compass unavailable/denied |
| GPS accuracy banner | ✅ | Color-coded; warns "tree canopy?" above 20m accuracy |
| Bee-flight confirmation counter | ✅ | Requires 3 confirmed return flights before bearing lock (reduces novice false-reads) |
| Point A / Point B capture | ✅ | GPS fix + locked bearing at each point |
| Live walk-path tracking | ✅ | `watchPosition()` draws actual path walked between A and B |
| Bearing ray visualization | ✅ | Dashed lines from A and B shown on map |
| Path-intersection geometry | ✅ | Spherical trigonometry solution (great-circle path intersection) |
| Confidence-radius candidate marker | ✅ | Radius scales with baseline distance between A and B |
| Turn-by-turn "Navigate to Hive" | ✅ | Live compass arrow + live distance countdown, walks user to candidate site |
| One-tap save as hive record | ✅ | Hands off lat/lng + auto-note to Add Hive form |

**Methodology implemented (matches traditional bee-hunting practice):**
1. Capture/feed bees, observe return flights toward colony
2. Confirm bearing with 3+ consistent flights (avoids unreliable first-flight reads)
3. Lock Point A bearing
4. Walk 45–90m (50–100 yards), tracked live on map
5. Lock Point B bearing
6. App calculates intersection — candidate site marked with confidence radius
7. Navigate to site with live turn-by-turn guidance
8. Save as a new hive record on arrival

---

### Phase 3 — Resilience & Research Layer ⬜ Planned

| Feature | Description |
|---|---|
| Re-verification check-ins | Gamified "is this hive still active?" revisits |
| Survivor tagging | Hives confirmed active 3+ winters → "Genetic Goldmine" badge |
| DCA heatmap | Overlapping 3-mile radii → predicted drone congregation areas |
| Ghost/collapse reporting | Log dead hives as early warning for commercial keepers |
| Year filter | Slider to show hives by observation year |

---

### Phase 4 — Guardian Network ⬜ Planned

| Feature | Description |
|---|---|
| Managed yard hex-masking | 1-mile hexagon obfuscation for commercial apiary privacy |
| Mite-bomb risk perimeter | Alert when feral collapse is logged within range of managed yards |
| Guardian accounts | Commercial beekeepers can register protected zones |

---

### Deferred (Post-Backend)

| Item | Reason for deferral |
|---|---|
| Firebase / Supabase backend | Need to finalize data architecture first |
| Full manifest.json | Needs real hosted URL + production icons |
| Service worker | Must know which routes to cache vs. fetch-fresh |
| System dark/light mode | Build after UI design is fully stable |
| Skeleton screens | Only relevant once async data loading exists |
| User authentication | Phase 3/4 requirement |

---

## 6. Changelog

| Version | Changes |
|---|---|
| v0.1 | Initial build — map, legacy data, LocalStorage |
| v0.2 | GPS graceful fallback, tile layer borders, ZIP search fix, Add Hive UX |
| v0.3 | Light grey CartoDB map, crosshair + live coords, dark UI |
| v0.4 | Man Made category (Building + Managed merged), Notes search, worldwide geocoding, mating radius cap removed |
| v0.5 | `visibleHives` single source of truth — phantom radius circles fixed |
| v0.6 | Design upgrade: Outfit font, glassmorphism header/nav/modals, safe area insets, touch targets 44px, shadow elevation system, rounded corners, micro-interactions |
| v0.7 | Responsive search bars (mobile stack / desktop side-by-side), worldwide geocoding fully unrestricted, inline spec block in HTML, this SPEC.md |
| v0.8 | Equal-width search bars via true flex parity, scrollable hive popups for long notes, simplified location search to city/landmark only (dropped unreliable ZIP-only geocoding) |
| v0.9 | Date stamps on all hive records — re-extracted full dates from legacy SQL (previously year-only), shown in popups and records list |
| v1.0 | **Phase 2 shipped** — Pathfinder beelining triangulation tool: live compass + manual fallback, GPS accuracy/canopy warning, bee-flight confirmation counter, Point A/B capture with bearing rays, live walk-path tracking, spherical-trigonometry intersection calculation, confidence-radius candidate marker, turn-by-turn live navigation to site, one-tap save to Add Hive |

---

## 7. Known Issues / Backlog

- Records list shows first 50 only — needs pagination or virtual scroll for scale
- Mating radius with 1,000+ visible pins may be slow on low-end devices — consider a "draw radii for viewport only" optimization
- Hive popup on mobile can be clipped at screen edges — needs Leaflet popup offset tuning
- No input validation on lat/lng beyond range check in Add Hive form

---

## 8. Collaboration Notes

- **Scout integration (proposed):** Troops act as field data collectors supervised by Level 4 "Master Pathfinder" users. STEM merit badge opportunity — beelining combines biology and geometry.
- **Commercial beekeeper angle:** Guardian Network gives them theft protection while contributing to mite-bomb research — positioned as win-win, not surveillance.
- **Media hook:** "Pokémon GO for bee conservation" — citizen science + gamification story for Wired/NatGeo/local news.
- **Research value:** Feral bees are the control group for CCD research — not transported, not fed sugar syrup. App maps the baseline.
