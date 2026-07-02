const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/App.jsx');
const mapPath = path.join(__dirname, '../src/components/MapComponent.jsx');
const hiveDataPath = path.join(__dirname, '../src/hiveData.js');

let hivesArrayStr = '[]';
try {
    const appStr = fs.readFileSync(appPath, 'utf8');
    const appMatch = appStr.match(/const\s+(?:ALL_DATA|INJECTED_HIVES)\s*=\s*(\[\s*\{[\s\S]*?\}\s*\]);/);
    if (appMatch && appMatch[1]) {
        hivesArrayStr = appMatch[1];
    }
} catch (e) {
    console.error("Failed to read array:", e);
    process.exit(1);
}

const newApp = `import React, { useState, useMemo } from 'react';
import MapComponent from './components/MapComponent';

const ALL_DATA = ${hivesArrayStr};

const TYPE_CONFIG = {
  TREE: '🌲', GROUND: '⛰️', BUILDING: '🏠', BEEHIVE: '🐝'
};

function App() {
  const [search, setSearch] = useState('');
  const [types, setTypes] = useState(['TREE', 'GROUND', 'BEEHIVE', 'BUILDING']);
  const [status, setStatus] = useState(['healthy', 'warning', 'at-risk']);
  const [counts, setCounts] = useState({ total: ALL_DATA.length, viewable: 0 });

  const filteredHives = useMemo(() => {
    return ALL_DATA.map(h => {
      const noteLower = (h.note || "").toLowerCase();
      let s = h.status;
      if (s === 'atRisk') s = 'at-risk';
      if (s === 'warning' && (noteLower.includes('healthy') || noteLower.includes('strong'))) s = 'healthy';
      return { ...h, status: s };
    }).filter(h => {
      const note = (h.note || "").toLowerCase();
      let t = 'BEEHIVE';
      if (note.includes('tree') || note.includes('pine') || note.includes('oak') || note.includes('snag') || note.includes('wood') || note.includes('forest')) t = 'TREE';
      else if (note.includes('ground') || note.includes('dirt') || note.includes('soil') || note.includes('earth') || note.includes('mound')) t = 'GROUND';
      else if (note.includes('building') || note.includes('house') || note.includes('wall') || note.includes('structure') || note.includes('roof') || note.includes('shed')) t = 'BUILDING';
      else if (note.includes('box') || note.includes('hive') || note.includes('nuc') || note.includes('feral') || note.includes('langstroth')) t = 'BEEHIVE';

      return types.includes(t) && status.includes(h.status) && 
             (!search || note.includes(search.toLowerCase())) && h.lng !== 0;
    });
  }, [search, types, status]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen bg-black text-white font-sans overflow-hidden">
      {/* HEADER: PILL SEARCH & TYPE TOGGLES */}
      <header className="z-[9999] bg-[#1a1a1a]/90 backdrop-blur-md p-4 border-b border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <input type="text" placeholder="Search notes..." value={search} onChange={(e)=>setSearch(e.target.value)}
            className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm border border-white/20 outline-none focus:border-yellow-500" />
          <div className="bg-yellow-500/20 text-yellow-500 px-3 py-2 rounded-full text-[10px] font-black border border-yellow-500/30">
            {counts.viewable} / {ALL_DATA.length}
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {Object.keys(TYPE_CONFIG).map(t => (
            <button key={t} onClick={() => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
              className={\`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all \${types.includes(t) ? 'bg-white text-black border-white' : 'bg-black/50 text-gray-500 border-white/5'}\`}>
              {TYPE_CONFIG[t]} {t}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 relative">
        {ALL_DATA.length > 0 && <MapComponent hives={filteredHives} onUpdate={setCounts} />}
        
        {/* HEALTH TOGGLES: FLOATING BOTTOM CENTER */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex gap-3 bg-black/60 backdrop-blur-xl p-3 rounded-full border border-white/10 shadow-2xl">
          {['healthy', 'warning', 'at-risk'].map(s => (
            <button key={s} onClick={() => setStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
              className={\`w-6 h-6 rounded-full border-2 transition-all \${status.includes(s) ? (s==='healthy'?'bg-green-500 border-green-300':s==='warning'?'bg-yellow-500 border-yellow-300':'bg-red-500 border-red-300') : 'bg-transparent border-white/10'}\`} />
          ))}
        </div>
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

const ICONS = { TREE: '🌲', GROUND: '⛰️', BUILDING: '🏠', BEEHIVE: '🐝' };

export default function MapComponent({ hives, onUpdate }) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);

  const syncView = useCallback(() => {
    if (!map.current) return;
    const b = map.current.getBounds();
    const v = hives.filter(h => h.lng >= b.getWest() && h.lng <= b.getEast() && h.lat >= b.getSouth() && h.lat <= b.getNorth()).length;
    onUpdate(prev => ({ ...prev, viewable: v }));
  }, [hives, onUpdate]);

  useEffect(() => {
    if (map.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => initMap([pos.coords.longitude, pos.coords.latitude]),
      () => initMap([-98.5, 39.8]), // Center of US
      { enableHighAccuracy: true }
    );

    function initMap(center) {
      map.current = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            's': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256 },
            'h': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}'], tileSize: 256 }
          },
          layers: [{ id: 's', type: 'raster', source: 's' }, { id: 'h', type: 'raster', source: 'h', paint: { 'raster-opacity': 0.35 } }]
        },
        center: center, zoom: 12, attributionControl: false
      });
      map.current.on('load', () => {
        map.current.addSource('rings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.current.addLayer({ id: 'rf', type: 'fill', source: 'rings', paint: { 'fill-color': '#76ff03', 'fill-opacity': 0.04 } });
        map.current.addLayer({ id: 'rl', type: 'line', source: 'rings', paint: { 'line-color': '#76ff03', 'line-width': 1, 'line-opacity': 0.2 } });
        syncView();
      });
      map.current.on('moveend', syncView);
    }
  }, [syncView]);

  useEffect(() => {
    if (!map.current || !map.current.loaded()) return;
    markers.current.forEach(m => m.remove());
    const ringData = hives.map(h => turf.circle([h.lng, h.lat], 3, { units: 'miles' }));
    map.current.getSource('rings').setData({ type: 'FeatureCollection', features: ringData });

    markers.current = hives.map(h => {
      const note = (h.note || "").toLowerCase();
      let type = 'BEEHIVE';
      if (note.includes('tree') || note.includes('pine') || note.includes('oak') || note.includes('snag') || note.includes('wood') || note.includes('forest')) type = 'TREE';
      else if (note.includes('ground') || note.includes('dirt') || note.includes('soil') || note.includes('earth') || note.includes('mound')) type = 'GROUND';
      else if (note.includes('building') || note.includes('house') || note.includes('wall') || note.includes('structure') || note.includes('roof') || note.includes('shed')) type = 'BUILDING';
      else if (note.includes('box') || note.includes('hive') || note.includes('nuc') || note.includes('feral') || note.includes('langstroth')) type = 'BEEHIVE';

      const el = document.createElement('div');
      const health = h.status === 'at-risk' ? '#ff1744' : h.status === 'warning' ? '#ff9100' : '#ffffff';
      el.style.cssText = \`display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:4px; background:white; border:2px solid \${health}; box-shadow:0 4px 10px rgba(0,0,0,0.5); cursor:pointer; font-size:14px;\`;
      el.innerText = ICONS[type];
      
      const p = new maplibregl.Popup({ offset: 12, closeOnClick: true }).setHTML(\`<div style="color:black; padding:8px; font-weight:bold;">\${h.date || '2026'}<br/>\${h.note}</div>\`);
      return new maplibregl.Marker({ element: el }).setLngLat([h.lng, h.lat]).setPopup(p).addTo(map.current);
    });
    syncView();
  }, [hives, syncView]);

  return (
    <div className="w-full h-full relative">
      <div ref={container} className="w-full h-full" />
      <div className="absolute top-4 right-4 flex flex-col gap-3 z-[9999]">
        <button onClick={() => {
          const b = new maplibregl.LngLatBounds();
          hives.forEach(h => {
             if (Number.isFinite(h.lng) && Number.isFinite(h.lat)) b.extend([h.lng, h.lat]);
          });
          map.current.fitBounds(b, { padding: 60 });
        }} className="bg-white/90 backdrop-blur text-black w-10 h-10 rounded-xl shadow-xl flex items-center justify-center text-xl font-bold">⛶</button>
        <button onClick={() => {
          if (navigator.geolocation) {
             navigator.geolocation.getCurrentPosition(pos => map.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12 }));
          }
        }} className="bg-white/90 backdrop-blur text-black w-10 h-10 rounded-xl shadow-xl flex items-center justify-center text-xl">🏠</button>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(mapPath, newMap);
console.log("V56 Architectural Lockdown applied.");
