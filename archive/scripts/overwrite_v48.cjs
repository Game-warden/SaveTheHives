const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/App.jsx');
const mapPath = path.join(__dirname, '../src/components/MapComponent.jsx');
const hiveDataPath = path.join(__dirname, '../src/hiveData.js');

let hivesArrayStr = '[]';
try {
    const hiveDataStr = fs.readFileSync(hiveDataPath, 'utf8');
    const match = hiveDataStr.match(/export\s+const\s+allHives\s*=\s*(\[\s*\{[\s\S]*?\}\s*\]);/);
    if (match && match[1]) {
        hivesArrayStr = match[1];
    } else {
        const appStr = fs.readFileSync(appPath, 'utf8');
        const appMatch = appStr.match(/const\s+(?:ALL_DATA|INJECTED_HIVES)\s*=\s*(\[\s*\{[\s\S]*?\}\s*\]);/);
        if (appMatch && appMatch[1]) {
            hivesArrayStr = appMatch[1];
        }
    }
} catch (e) {
    console.error("Failed to read array:", e);
    process.exit(1);
}

const newApp = `import React, { useState, useMemo } from 'react';
import MapComponent from './components/MapComponent';

// AGENT: Paste the full 1162 hives here
const ALL_DATA = ${hivesArrayStr};

const TYPE_CONFIG = {
  TREE: { color: '#81C784', icon: '🌲' },
  GROUND: { color: '#FF7043', icon: '🕳' },
  BUILDING: { color: '#90A4AE', icon: '🏠' },
  BEEHIVE: { color: '#FFD54F', icon: '🐝' }
};

function App() {
  const [search, setSearch] = useState('');
  const [types, setTypes] = useState(['TREE', 'GROUND', 'BEEHIVE', 'BUILDING']);
  const [status, setStatus] = useState(['healthy', 'warning', 'at-risk']);
  const [counts, setCounts] = useState({ total: ALL_DATA.length, viewable: 0 });

  const filtered = useMemo(() => {
    return ALL_DATA.filter(h => {
      const n = h.note?.toUpperCase() || "";
      let t = 'BEEHIVE';
      if (n.includes('[TREE]')) t = 'TREE';
      else if (n.includes('[GROUND]')) t = 'GROUND';
      else if (n.includes('[BUILDING]')) t = 'BUILDING';
      
      const match = types.includes(t) && status.includes(h.status) && 
                    (!search || h.note?.toLowerCase().includes(search.toLowerCase()));
      
      // Robust coordinate sanitization to prevent Entire Globe bug
      const lng = Number(h.lng);
      const lat = Number(h.lat);
      return match && Number.isFinite(lng) && Number.isFinite(lat) && lng !== 0 && lat !== 0;
    });
  }, [search, types, status]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen bg-black text-white font-sans overflow-hidden">
      <header className="z-[999] bg-[#1a1a1a]/95 backdrop-blur-md p-4 border-b-2 border-yellow-500 shadow-2xl">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest mb-4">
          <span className="text-yellow-400">Database: {ALL_DATA.length}</span>
          <span className="bg-white/10 px-3 py-1 rounded-full border border-white/20">View: {counts.viewable}</span>
        </div>
        <input 
          type="text" placeholder="FILTER BY NOTES..." 
          className="w-full bg-[#333] text-white p-3 rounded-xl mb-4 border border-white/10 focus:border-yellow-500 outline-none transition-all"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {Object.entries(TYPE_CONFIG).map(([t, cfg]) => (
              <button key={t} onClick={() => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                className={\`flex-1 flex flex-col items-center py-2 rounded-lg border-2 transition-all \${types.includes(t) ? 'bg-white text-black border-yellow-500 shadow-[0_0_15px_rgba(255,215,0,0.3)]' : 'bg-transparent text-gray-500 border-white/5'}\`}>
                <span className="text-lg">{cfg.icon}</span>
                <span className="text-[8px] font-black tracking-tighter">{t}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {['healthy', 'warning', 'at-risk'].map(s => (
              <button key={s} onClick={() => setStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
                className={\`flex-1 py-1 rounded-md text-[9px] font-black uppercase border transition-all \${status.includes(s) ? 'bg-red-600 text-white border-red-400' : 'bg-transparent text-gray-600 border-white/5'}\`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1 relative bg-[#0a0a0a]">
        <MapComponent hives={filtered} onUpdate={setCounts} />
      </main>
    </div>
  );
}
export default App;
`;

fs.writeFileSync(appPath, newApp);

const newMap = `import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import 'maplibre-gl/dist/maplibre-gl.css';

const TYPE_ICONS = { TREE: '🌲', GROUND: '🕳', BUILDING: '🏠', BEEHIVE: '🐝' };

export default function MapComponent({ hives, onUpdate }) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);

  const syncView = useCallback(() => {
    if (!map.current) return;
    const b = map.current.getBounds();
    const visible = hives.filter(h => h.lng >= b.getWest() && h.lng <= b.getEast() && h.lat >= b.getSouth() && h.lat <= b.getNorth()).length;
    onUpdate(prev => ({ ...prev, viewable: visible }));
  }, [hives, onUpdate]);

  useEffect(() => {
    if (map.current) return;
    map.current = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: { 'pure-sat': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256 } },
        layers: [{ id: 'sat', type: 'raster', source: 'pure-sat' }]
      },
      center: [-90.0715, 29.9511], zoom: 12, attributionControl: false
    });

    map.current.on('load', () => {
      map.current.addSource('rings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.current.addLayer({ id: 'rl', type: 'fill', source: 'rings', paint: { 'fill-color': '#76ff03', 'fill-opacity': 0.12 } });
      syncView();
    });
    map.current.on('moveend', syncView);
  }, [syncView]);

  useEffect(() => {
    if (!map.current || !map.current.loaded()) return;
    markers.current.forEach(m => m.remove());

    // 1. Precise Rings - Enforced Cast to Number
    const ringData = hives.map(h => turf.circle([Number(h.lng), Number(h.lat)], 3, { units: 'miles' }));
    map.current.getSource('rings').setData({ type: 'FeatureCollection', features: ringData });

    // 2. High-Fidelity Icon Markers
    markers.current = hives.map(h => {
      const n = h.note?.toUpperCase() || "";
      let type = 'BEEHIVE';
      if (n.includes('[TREE]')) type = 'TREE';
      else if (n.includes('[GROUND]')) type = 'GROUND';
      else if (n.includes('[BUILDING]')) type = 'BUILDING';

      const el = document.createElement('div');
      const healthColor = h.status === 'at-risk' ? '#ff1744' : h.status === 'warning' ? '#ff9100' : '#ffffff';
      el.style.cssText = \`
        display: flex; align-items: center; justify-content: center;
        width: 24px; height: 24px; border-radius: 6px;
        background: rgba(255,255,255,0.9);
        border: 2px solid \${healthColor};
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        cursor: pointer; font-size: 16px;
      \`;
      el.innerText = TYPE_ICONS[type];
      
      const p = new maplibregl.Popup({ offset: 12, closeOnClick: true, maxWidth: '200px' })
        .setHTML(\`<div style="color:#222; padding:10px; font-family:sans-serif;">
                    <div style="font-size:10px; opacity:0.6; font-weight:bold; margin-bottom:4px;">\${h.date || '2026'}</div>
                    <div style="font-size:13px; line-height:1.3; font-weight:700;">\${h.note}</div>
                  </div>\`);

      return new maplibregl.Marker({ element: el }).setLngLat([Number(h.lng), Number(h.lat)]).setPopup(p).addTo(map.current);
    });
    syncView();
  }, [hives, syncView]);

  return (
    <div className="w-full h-full relative">
      <div ref={container} className="w-full h-full" />
      <div className="absolute top-4 right-4 flex flex-col gap-3 z-[999]">
        <button onClick={() => {
          if (hives.length === 0) return;
          const b = new maplibregl.LngLatBounds();
          hives.forEach(h => {
             b.extend([Number(h.lng), Number(h.lat)]);
          });
          map.current.fitBounds(b, { padding: 60, maxZoom: 15 });
        }} className="bg-white/90 text-black w-10 h-10 rounded-xl shadow-xl flex items-center justify-center text-xl font-bold backdrop-blur">⛶</button>
        <button onClick={() => {
          navigator.geolocation.getCurrentPosition(pos => {
            map.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12 });
          });
        }} className="bg-white/90 text-black w-10 h-10 rounded-xl shadow-xl flex items-center justify-center text-xl backdrop-blur">🏠</button>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(mapPath, newMap);
console.log("V48 Precision Graphics Overwrite Complete.");
