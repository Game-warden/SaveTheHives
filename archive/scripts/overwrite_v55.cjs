const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/App.jsx');
const mapPath = path.join(__dirname, '../src/components/MapComponent.jsx');
const hiveDataPath = path.join(__dirname, '../src/hiveData.js');

// 1. Array Extraction
let hivesArrayStr = '[]';
try {
    const appStr = fs.readFileSync(appPath, 'utf8');
    const appMatch = appStr.match(/const\s+(?:ALL_DATA|INJECTED_HIVES)\s*=\s*(\[\s*\{[\s\S]*?\}\s*\]);/);
    if (appMatch && appMatch[1]) {
        hivesArrayStr = appMatch[1];
    } else {
        const hiveDataStr = fs.readFileSync(hiveDataPath, 'utf8');
        const match = hiveDataStr.match(/export\s+const\s+allHives\s*=\s*(\[\s*\{[\s\S]*?\}\s*\]);/);
        if (match && match[1]) {
            hivesArrayStr = match[1];
        }
    }
} catch (e) {
    console.error("Failed to read array:", e);
    process.exit(1);
}

const newApp = `import React, { useState, useMemo, useEffect } from 'react';
import MapComponent from './components/MapComponent';

// AGENT: PASTE ALL 1162 HIVES HERE
const ALL_DATA = ${hivesArrayStr};

const TYPE_DEFS = {
  TREE: { icon: '🌲', keys: ['tree', 'pine', 'oak', 'snag', 'wood', 'forest'] }, 
  GROUND: { icon: '⛰️', keys: ['ground', 'dirt', 'earth', 'soil', 'mound'] }, 
  BUILDING: { icon: '🏠', keys: ['building', 'structure', 'house', 'roof', 'wall', 'shed'] }, 
  BEEHIVE: { icon: '🐝', keys: ['box', 'hive', 'nuc', 'feral', 'langstroth'] }
};

function App() {
  const [search, setSearch] = useState('');
  const [zip, setZip] = useState('');
  const [types, setTypes] = useState(['TREE', 'GROUND', 'BEEHIVE', 'BUILDING']);
  const [status, setStatus] = useState(['healthy', 'warning', 'at-risk']);
  const [counts, setCounts] = useState({ total: ALL_DATA.length, viewable: 0 });
  const [targetCoords, setTargetCoords] = useState(null);

  const handleZipSearch = async (e) => {
    if (e.key === 'Enter' && zip.length === 5) {
      try {
        const res = await fetch(\`https://nominatim.openstreetmap.org/search?postalcode=\${zip}&country=US&format=json\`);
        const data = await res.json();
        if (data[0]) setTargetCoords([parseFloat(data[0].lon), parseFloat(data[0].lat)]);
      } catch (err) { console.error("Zip search failed", err); }
    }
  };

  const filteredHives = useMemo(() => {
    return ALL_DATA.map(h => {
      const noteLower = (h.note || "").toLowerCase();
      let realStatus = h.status;
      // Database fix for string mapping matching
      if (realStatus === 'atRisk') realStatus = 'at-risk';
      
      if (realStatus === 'warning' && (noteLower.includes('healthy') || noteLower.includes('strong'))) realStatus = 'healthy';
      return { ...h, status: realStatus };
    }).filter(h => {
      const note = (h.note || "").toLowerCase();
      let detected = 'BEEHIVE';
      
      if (TYPE_DEFS.TREE.keys.some(k => note.includes(k))) detected = 'TREE';
      else if (TYPE_DEFS.GROUND.keys.some(k => note.includes(k))) detected = 'GROUND';
      else if (TYPE_DEFS.BUILDING.keys.some(k => note.includes(k))) detected = 'BUILDING';

      return types.includes(detected) && status.includes(h.status) && 
             (!search || note.includes(search.toLowerCase())) && h.lng !== 0;
    });
  }, [search, types, status]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen bg-black text-white overflow-hidden font-sans select-none">
      <header className="z-[999] bg-[#1a1a1a]/90 backdrop-blur-md p-3 border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/10 rounded-full flex items-center px-4 py-2 border border-white/10">
            <span className="mr-2 opacity-40">🔍</span>
            <input type="text" placeholder="Search notes..." className="bg-transparent border-none outline-none text-sm w-full"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="text-[10px] font-black text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20">
            {counts.viewable} / {ALL_DATA.length}
          </div>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto no-scrollbar">
          {Object.keys(TYPE_DEFS).map(t => (
            <button key={t} onClick={() => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
              className={\`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all \${types.includes(t) ? 'bg-white text-black border-white' : 'bg-black/40 text-gray-500 border-white/5'}\`}>
              <span>{TYPE_DEFS[t].icon}</span> {t}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 relative bg-[#0a0a0a]">
        <MapComponent hives={filteredHives} onUpdate={setCounts} flyTo={targetCoords} />
      </main>

      <footer className="z-[999] bg-[#1a1a1a]/95 backdrop-blur-xl border-t border-white/10 p-4 pb-[env(safe-area-inset-bottom)] flex items-center gap-4">
        <button onClick={() => alert('Menu Open')} className="text-xl opacity-60">☰</button>
        <div className="flex-1 relative">
          <input type="text" placeholder="Zipcode..." className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs outline-none focus:border-yellow-500"
            value={zip} onChange={(e) => setZip(e.target.value)} onKeyDown={handleZipSearch} />
          <span className="absolute right-3 top-2.5 opacity-30">📍</span>
        </div>
        <div className="flex gap-2">
          {['healthy', 'warning', 'at-risk'].map(s => (
            <button key={s} onClick={() => setStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
              className={\`w-4 h-4 rounded-full border-2 \${status.includes(s) ? (s==='healthy'?'bg-green-500 border-green-300':s==='warning'?'bg-yellow-500 border-yellow-300':'bg-red-500 border-red-300') : 'bg-transparent border-white/10'}\`} />
          ))}
        </div>
      </footer>
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
const TYPE_KEYS = {
  TREE: ['tree', 'pine', 'oak', 'snag', 'wood', 'forest'],
  GROUND: ['ground', 'dirt', 'earth', 'soil', 'mound'],
  BUILDING: ['building', 'structure', 'house', 'roof', 'wall', 'shed'],
  BEEHIVE: ['box', 'hive', 'nuc', 'feral', 'langstroth']
};

export default function MapComponent({ hives, onUpdate, flyTo }) {
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
    if (map.current && flyTo) map.current.flyTo({ center: flyTo, zoom: 14 });
  }, [flyTo]);

  useEffect(() => {
    if (map.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => initMap([pos.coords.longitude, pos.coords.latitude]),
      () => initMap([-90.0715, 29.9511]),
      { enableHighAccuracy: true }
    );

    function initMap(center) {
      map.current = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            'sat': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256 },
            'lbl': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}'], tileSize: 256 }
          },
          layers: [
            { id: 'sat', type: 'raster', source: 'sat' },
            { id: 'lbl', type: 'raster', source: 'lbl', paint: { 'raster-opacity': 0.35 } }
          ]
        },
        center: center, zoom: 12, attributionControl: false
      });

      map.current.on('load', () => {
        map.current.addSource('rings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.current.addLayer({ id: 'rf', type: 'fill', source: 'rings', paint: { 'fill-color': '#76ff03', 'fill-opacity': 0.04 } });
        map.current.addLayer({ id: 'rl', type: 'line', source: 'rings', paint: { 'line-color': '#76ff03', 'line-width': 1, 'line-opacity': 0.2, 'line-dasharray': [2, 2] } });
        syncView();
      });
      map.current.on('moveend', syncView);
    }
  }, [syncView]);

  useEffect(() => {
    if (!map.current || !map.current.loaded()) return;
    markers.current.forEach(m => m.remove());
    const validHives = hives.filter(h => Number.isFinite(Number(h.lng)) && Number.isFinite(Number(h.lat)));

    const ringData = validHives.map(h => turf.circle([Number(h.lng), Number(h.lat)], 3, { units: 'miles' }));
    map.current.getSource('rings').setData({ type: 'FeatureCollection', features: ringData });

    markers.current = validHives.map(h => {
      const note = (h.note || "").toLowerCase();
      let type = 'BEEHIVE';
      if (TYPE_KEYS.TREE.some(k => note.includes(k))) type = 'TREE';
      else if (TYPE_KEYS.GROUND.some(k => note.includes(k))) type = 'GROUND';
      else if (TYPE_KEYS.BUILDING.some(k => note.includes(k))) type = 'BUILDING';

      const health = h.status === 'at-risk' || h.status === 'atRisk' ? '#ff1744' : h.status === 'warning' ? '#ff9100' : '#ffffff';
      const el = document.createElement('div');
      el.style.cssText = \`display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:4px; background:white; border:2px solid \${health}; box-shadow:0 4px 10px rgba(0,0,0,0.5); cursor:pointer; font-size:14px;\`;
      el.innerText = ICONS[type];
      
      const p = new maplibregl.Popup({ offset: 12, closeOnClick: true }).setHTML(\`<div style="color:black; padding:8px; font-weight:bold;">\${h.date || '2026'}<br/>\${h.note}</div>\`);
      return new maplibregl.Marker({ element: el }).setLngLat([Number(h.lng), Number(h.lat)]).setPopup(p).addTo(map.current);
    });
    syncView();
  }, [hives, syncView]);

  return <div ref={container} className="w-full h-full relative" />;
}
`;
fs.writeFileSync(mapPath, newMap);

console.log("V55 Final Engineering Gate Overwrite Complete.");
