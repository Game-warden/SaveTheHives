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
        // Fallback to reading from current App.jsx if hiveData exports differ
        const appStr = fs.readFileSync(appPath, 'utf8');
        const appMatch = appStr.match(/const\s+INJECTED_HIVES\s*=\s*(\[\s*\{[\s\S]*?\}\s*\]);/);
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

// DIRECT INJECTION: Agent MUST paste all 1162 hives here
const ALL_DATA = ${hivesArrayStr};

const TYPE_COLORS = { 
  TREE: '#5D4037',     // Deep Forest Brown
  GROUND: '#FF3D00',   // Safety Orange
  BUILDING: '#37474F', // Solid Charcoal
  BEEHIVE: '#FFEA00'   // Neon Sunflower
};

function App() {
  const [search, setSearch] = useState('');
  const [types, setTypes] = useState(['TREE', 'GROUND', 'BEEHIVE', 'BUILDING']);
  const [status, setStatus] = useState(['healthy', 'warning', 'at-risk']);
  const [counts, setCounts] = useState({ total: ALL_DATA.length, viewable: 0 });

  const filteredHives = useMemo(() => {
    return ALL_DATA.filter(h => {
      const n = h.note?.toUpperCase() || "";
      let t = 'BEEHIVE';
      if (n.includes('[TREE]')) t = 'TREE';
      else if (n.includes('[GROUND]')) t = 'GROUND';
      else if (n.includes('[BUILDING]')) t = 'BUILDING';
      
      const typeMatch = types.includes(t);
      const statusMatch = status.includes(h.status);
      const searchMatch = !search || h.note?.toLowerCase().includes(search.toLowerCase());
      
      return typeMatch && statusMatch && searchMatch;
    });
  }, [search, types, status]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen bg-[#111] text-white overflow-hidden select-none">
      <header className="z-[999] bg-[#222] p-4 border-b-4 border-yellow-500 shadow-2xl">
        <div className="flex justify-between items-center text-[11px] font-black mb-4">
          <span className="text-yellow-400">HIVES: {\`\${ALL_DATA.length}\`}</span>
          <span className="bg-white/10 px-2 py-0.5 rounded">VISIBLE: {counts.viewable}</span>
        </div>
        <input 
          type="text" placeholder="SEARCH NOTES..." 
          className="w-full bg-white text-black p-3 rounded font-bold mb-4 outline-none focus:ring-4 ring-yellow-500/50"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {Object.keys(TYPE_COLORS).map(t => (
              <button key={t} onClick={() => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                className={\`flex-1 flex items-center justify-center gap-2 py-2.5 rounded border-2 text-[10px] font-black transition-all \${types.includes(t) ? 'bg-white text-black border-yellow-500 shadow-lg scale-105' : 'bg-black/50 text-gray-600 border-white/10'}\`}>
                <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: TYPE_COLORS[t]}} />{t}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {['healthy', 'warning', 'at-risk'].map(s => (
              <button key={s} onClick={() => setStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
                className={\`flex-1 py-1.5 rounded text-[9px] font-black uppercase border-2 transition-all \${status.includes(s) ? (s==='healthy'?'bg-green-600':'bg-red-600') + ' text-white border-white' : 'bg-transparent text-gray-700 border-white/10'}\`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1 relative bg-black">
        <MapComponent hives={filteredHives} onUpdate={setCounts} />
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

const TYPE_COLORS = { TREE: '#5D4037', GROUND: '#FF3D00', BUILDING: '#37474F', BEEHIVE: '#FFEA00' };

export default function MapComponent({ hives, onUpdate }) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);

  const syncCounter = useCallback(() => {
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
        sources: { 'g-sat': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'], tileSize: 256 } },
        layers: [{ id: 'sat', type: 'raster', source: 'g-sat' }]
      },
      center: [-90.0715, 29.9511], zoom: 12
    });

    map.current.on('load', () => {
      map.current.addSource('rings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.current.addLayer({ id: 'rl', type: 'fill', source: 'rings', paint: { 'fill-color': '#ccff00', 'fill-opacity': 0.1 } });
      syncCounter();
    });
    map.current.on('moveend', syncCounter);
  }, [syncCounter]);

  useEffect(() => {
    if (!map.current || !map.current.loaded()) return;
    markers.current.forEach(m => m.remove());

    const valid = hives.filter(h => Number.isFinite(h.lng) && Number.isFinite(h.lat));
    
    // Proximity Rings
    try {
        const ringData = valid.map(h => turf.circle([h.lng, h.lat], 3, { units: 'miles' }));
        map.current.getSource('rings').setData({ type: 'FeatureCollection', features: ringData });
    } catch (e) { console.warn("Ring sync delayed..."); }

    // Pins
    markers.current = valid.map(h => {
      const n = h.note?.toUpperCase() || "";
      let color = TYPE_COLORS.BEEHIVE;
      if (n.includes('[TREE]')) color = TYPE_COLORS.TREE;
      else if (n.includes('[GROUND]')) color = TYPE_COLORS.GROUND;
      else if (n.includes('[BUILDING]')) color = TYPE_COLORS.BUILDING;

      const border = h.status === 'at-risk' ? '5px solid #FF1744' : h.status === 'warning' ? '5px solid #FF9100' : '2px solid white';
      const el = document.createElement('div');
      el.style.cssText = \`width:20px; height:20px; border-radius:50%; background:\${color}; border:\${border}; box-shadow:0 0 12px black; cursor:pointer;\`;
      
      const p = new maplibregl.Popup({ offset: 15, closeOnClick: false })
        .setHTML(\`<div style="color:black; padding:8px; font-family:sans-serif; min-width:150px;">
                    <div style="font-size:10px; color:#666; font-weight:bold; border-bottom:1px solid #ddd; margin-bottom:5px;">\${h.date || '2026'}</div>
                    <div style="font-size:13px; line-height:1.4; font-weight:700;">\${h.note}</div>
                  </div>\`);

      return new maplibregl.Marker({ element: el, draggable: false }).setLngLat([h.lng, h.lat]).setPopup(p).addTo(map.current);
    });
    syncCounter();
  }, [hives, syncCounter]);

  return (
    <div className="w-full h-full relative">
      <div ref={container} className="w-full h-full" />
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[999]">
        <button onClick={() => {
          const b = new maplibregl.LngLatBounds();
          hives.forEach(h => {
            if (Number.isFinite(h.lng) && Number.isFinite(h.lat)) b.extend([h.lng, h.lat]);
          });
          map.current.fitBounds(b, { padding: 80 });
        }} className="bg-white text-black w-12 h-12 rounded shadow-2xl flex items-center justify-center text-2xl font-bold">⛶</button>
        <button onClick={() => {
          navigator.geolocation.getCurrentPosition(pos => {
            map.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12 });
          });
        }} className="bg-white text-black w-12 h-12 rounded shadow-2xl flex items-center justify-center text-2xl">🏠</button>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(mapPath, newMap);
console.log("Master Overwrite Complete.");
