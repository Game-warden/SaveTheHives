# SaveTheHives_2: Core Logic and Render Architecture

## 1. The Great Coordinate Shift (WebGL / MapLibre)
In version 1 (Leaflet), maps typically consumed coordinates as `[Latitude, Longitude]`. 
In SaveTheHives_2, the migration to **MapLibre GL JS** strictly enforces the international GeoJSON standard of **`[Longitude, Latitude]`**. 

All arrays passed to `setLngLat()` or `flyTo()` are exclusively configured in `[Lng, Lat]` format to prevent rendering crashes and offshore markers.

## 2. Hive Classification Logic: "Bracket Supremacy"
The core categorizer for legacy notes prioritizes parsing the data intelligently.

### Priority Queue:
1. **Bracket Supremacy** - If a note contains bracketed tags (e.g. `[Living Tree]`), the engine bypasses arbitrary text parsing and immediately classifies the hive based tightly on the brackets' content.
2. **Natural Priority** - If no brackets exist, the engine checks for `Tree` or `Ground` indicators *first*. This prevents generic words like "wood" or "dirt" from being misattributed to nearby structures.
3. **Manmade Structures** - The engine then looks for `building`, `structure`, `house`, etc.
4. **Beekeeping Equipment** - The final check isolates specific beekeeping terminology (`beehive`, `langstroth`, `nuc`) without falsely matching the generic word "hive" (which is often used colloquially for feral colonies).

## 3. High-Performance WebGL Data Layering
To ensure 60fps mapping interactivity even with thousands of points, MapComponent.jsx uses a split-rendering strategy:
- **FeatureCollections:** The 4,828m Foraging Rings are injected directly into a GeoJSON `FeatureCollection` utilizing MapLibre's native vector `circle-radius` painting system.
- **HTML DOM Overlays:** The core click-points (the colored Map pointers) are injected via `new maplibregl.Marker()`. This allows custom HTML, CSS styling, and tooltips while relying on the WebGL canvas to handle the scaling mathematics.
