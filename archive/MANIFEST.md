# 🍯 SaveTheHives_2: MANIFEST.md (V118)
🚀 CURRENT LIVE VERSION: 2026-02-26 20:30
🔄 WHAT CHANGED (V117 → V118)
ADDED: DCA Logic Info Modal: An educational overlay that explains the metrics used for mating hub predictions [cite: 2026-02-26].
REFINED: Heatmap Weighting: The "red-glow" intensity is now tied exclusively to the density of "Green" (Healthy) hives to emphasize high-quality survivor genetics [cite: 2026-02-26].
DE-PRIORITIZED: The Health Matrix is now minimized by default to prevent "over-analysis" of legacy data [cite: 2026-02-26].
STABLE: #ID Jump, Typography, and Global Sanitization verified ✅ [cite: 2026-02-26].

🧬 The DCA Designation Metrics
When the DCA toggle is active, the engine uses these three primary data points to generate that glow [cite: 2026-02-26]:

Survivor Proximity: Centers the heatmap on hives tagged as [healthy] or active, prioritizing areas where known survivors can contribute drones [cite: 2026-02-26].
Flyway Overlap: Uses a 1,500m radius (The "Woodgate Constant") to identify where multiple colony flight paths overlap [cite: 2026-02-26].
Density Saturation: The transition from yellow to red indicates a higher concentration of overlapping circles—mathematically, the most "genetically diverse" mating ground [cite: 2026-02-26].

### 1. 📂 Project Identity & Environment
* **Project Name**: Save The Hives PWA (V2)
* **Local Project Path**: `/Users/ronniebouchon/SaveTheHives-pwa`
* **Primary Engine**: MapLibre GL JS (Vector)

### 2. 🛡️ Ethics & Security Framework (The "Do No Harm" Code)
❌ **Precision Blur**: Public users see 200m "Fuzzy Circles" instead of precise pins.
✅ **Privacy by Default**: All new entries are "Private" until explicitly opted-in.
✅ **Legal Permission Toggle**: Mandatory checkbox for legal access/beelining rights.
❌ **Biosecurity Acknowledgment**: Prompt for "Clean Gear" to prevent AFB/Varroa spread.
❌ **Researcher-Only Tiers**: Restricted access to high-value feral hives on public lands.

### 3. 🧪 Automated Self-Test Script (Pre-Flight)
✅ **Data Integrity**: Tested array counts map linearly to structural database indexes.
✅ **Map-to-State Sync**: DOM marker count is strictly synced with the Live Counter string. Empty arrays explicitly wipe the DOM canvas.
✅ **Instant Load**: Map populates makers immediately on browser refresh.
✅ **Persistence**: UI toggle states survive a hard browser refresh via `localStorage`.
✅ **Data Sanitization**: Regex pipeline (`[^\x20-\x7E]` && `[\u0000-\u001F\u007F-\u009F]`) actively strips hidden UTF-8/Ghost artifacts and control characters from raw arrays.

### 4. 📱 UI Control Registry (Functional Audit)
✅ **🏠 Home/GPS**: Verified. Raw SVG Node Button active. Browser "Allow Location" prompt triggers MapLibre `flyTo`.
✅ **🔍 Notes Search**: Verified (#ID Support ✅ Auto-Zoom Level 19 ✅, Multi-Content Strings ✅). Search Bar Input scaled to `16px` to block aggressive iOS zoom focus.
✅ **📍 Search Zipcode**: Verified.
✅ **📊 Analytics Modal**: Verified. Custom $3 \times 4$ Researcher Visibility Matrix mapping Health vs Hive Type dynamically.
✅ **⌨️ Console Commands**: 
   - `audit()` — The guided prompt system correctly captures arrays. Explicit user instructions.
   - `exportAudit()` — Actively diffs mutations and spits out a JSON export block for the AG Agent.
✅ **🟢 Status Toggles**: PASS. Buttons actively filter by hive health. Gray (🔘) filter dot active.
✅ **☰ Hamburger Menu**: Raw SVG Node Button active. Fixed Position, Bottom-Left Layout verified.
✅ **📱 Mobile Responsive**: Verified for iPhone 14+ safe areas (min-width flex bypass).
✅ **💊 Category Pills**: Row 2 Toggles for **TREE (🌲)**, **GROUND (⛰️)**, **BUILDING (🏠)**, **BEEHIVE (🐝)**.
✅ **🧬 Genetic Toggle**: Logic verified.
✅ **⭕ Foraging Rings**: 3-mile radius overlays with 4% additive transparency.
✅ **⛶ Fit-to-Bounds**: Auto-zoom to currently filtered markers.
✅ **🎨 Typography Reset**: Scoped sans-serif DOM injection `<style>` block mapping over rigid SVG icon layouts. High-contrast Map popups active.

### 5. 🏛️ Unified Science Portal (NCSU Research Focus)
✅ **Survivor Stock Tracking**: Differentiating Feral (Self-Sustaining) vs. Managed colonies.
✅ **NCSU Tarpy Lab Feed**: 2025/2026 Queen Quality and Varroa resistance studies.
🚀 **DCA Topographic Engine**: 3D contour analysis for mating hub prediction via 1,500m heatmap overlays. Glow is restricted ONLY to healthy/survivor colonies. Trigger Info Modal (?) active for logic transparency.

### 6. 🧭 Educational & Automated Beelining
🚀 **Bee Box Masterclass**: Integrated digital tutorial for capture/release cycles.
🚀 **Time-Based Method**: Integrated stopwatch and distance formula ($d = \frac{(t_{r} - t_{o}) \times v_{b}}{2}$).
🚀 **Vector-Based Method**: Triangulation of bearings from Point A and Point B.

👉 **CHRONOLOGICAL HISTORY IN** `Historical_Manifest.md`
