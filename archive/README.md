# SaveTheHives_2

Welcome to SaveTheHives_2, the next generation of the SaveTheHives platform. This Progressive Web Application (PWA) helps beekeepers and environmentalists track, protect, and map feral and managed honeybee colonies.

## WebGL & Performance Optimization

SaveTheHives_2 has migrated from Leaflet to **MapLibre GL JS** to harness the incredible power of WebGL and GPU acceleration. 

### Key Improvements:
- **Instant Rendering:** Capable of rendering thousands of data points (markers and foraging rings) simultaneously without dropping frames.
- **Hardware Acceleration:** Offloads mathematical rendering to the client device's GPU, preserving battery life and massively improving touch responsiveness on modern mobile devices.
- **Native [Lng, Lat] System:** Fully compliant with the standard GeoJSON specification for longitudes and latitudes.

## Setup & Deployment

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Local Development Server:**
   ```bash
   npm run dev
   ```
3. **Build Next-Gen PWA:**
   ```bash
   npm run build
   ```

## Tech Stack
- **React (Vite)**
- **Tailwind CSS**
- **MapLibre GL JS**
- **Vite PWA Plugin** (for Service Workers and Offline Support)
