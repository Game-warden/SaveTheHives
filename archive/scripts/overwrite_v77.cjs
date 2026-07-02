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

const ALL_DATA = ${hivesArrayStr};

const TYPE_CONFIG = {
  TREE: '🌲', GROUND: '⛰️', BUILDING: '🏠', BEEHIVE: '🐝'
};

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategories, setActiveCategories] = useState(['Tree', 'Mound', 'Building', 'Beehive']);
  const [geneticFilter, setGeneticFilter] = useState('All');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [viewableCount, setViewableCount] = useState(ALL_DATA.length);

  const filteredHives = useMemo(() => {
    return ALL_DATA.map(h => {
        const noteLower = (h.note || "").toLowerCase();
        let s = h.status;
        if (s === 'atRisk') s = 'at-risk';
        if (s === 'warning' && (noteLower.includes('healthy') || noteLower.includes('strong'))) s = 'healthy';
        return { ...h, status: s };
    }).filter(hive => {
      const notes = (hive.note || "").toLowerCase();
      const matchesSearch = notes.includes(searchTerm.toLowerCase());
      
      const isTree = notes.includes('[tree]') || (activeCategories.includes('Tree') && /tree|pine|oak|snag|wood/i.test(notes));
      const isMound = notes.includes('[ground]') || (activeCategories.includes('Mound') && /ground|dirt|earth|mound/i.test(notes));
      const isBuilding = notes.includes('[building]') || (activeCategories.includes('Building') && /building|structure|house|roof|wall/i.test(notes));
      const isHive = notes.includes('[beehive]') || (activeCategories.includes('Beehive') && /box|hive|nuc|feral/i.test(notes));

      const isFeral = /tree|building|feral/i.test(notes) && !/box|langstroth|managed/i.test(notes);
      const matchesGenetics = geneticFilter === 'All' || 
                             (geneticFilter === 'Feral' && isFeral) || 
                             (geneticFilter === 'Managed' && !isFeral);

      // We maintain the required Coordinate Guard [lng !== 0]
      return matchesSearch && (isTree || isMound || isBuilding || isHive) && matchesGenetics && hive.lng !== 0;
    });
  }, [searchTerm, activeCategories, geneticFilter]);

  useEffect(() => { setViewableCount(filteredHives.length); }, [filteredHives]);

  return (
    <div className="app-container" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* SCIENCE SIDEBAR - Slide in from left */}
      <aside className={\`science-sidebar \${isSidebarOpen ? 'open' : ''}\`} style={{
        position: 'fixed', left: isSidebarOpen ? '0' : '-300px',
        width: '300px', height: '100%', background: '#1a1a1a', color: 'white',
        zIndex: 10000, transition: 'left 0.3s ease', padding: '20px',
        boxShadow: '2px 0 5px rgba(0,0,0,0.5)'
      }}>
        <button onClick={() => setSidebarOpen(false)} style={{ float: 'right', fontSize:'24px', background:'transparent', border:'none', color:'white', cursor:'pointer' }}>×</button>
        <h2 style={{ marginTop: '0', borderBottom: '1px solid #333', paddingBottom: '10px' }}>🏛️ Science Portal</h2>
        
        <div className="research-feed" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ padding: '15px', background: '#222', borderRadius: '8px', border: '1px solid #333' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#fbbf24' }}>NCSU Tarpy Lab (2025)</h4>
            <p style={{ fontSize: '0.85em', margin: '0 0 10px 0', color: '#aaa' }}>Comparison of Varroa resistance in feral survivor stock.</p>
            <a href="https://entomology.ces.ncsu.edu/apiculture/" target="_blank" rel="noreferrer" style={{ fontSize: '0.85em', color: '#60a5fa', textDecoration: 'none' }}>Full Research ↗</a>
          </div>
          <div style={{ padding: '15px', background: '#222', borderRadius: '8px', border: '1px solid #333' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#fbbf24' }}>Queen Quality (2026)</h4>
            <p style={{ fontSize: '0.85em', margin: '0 0 10px 0', color: '#aaa' }}>Benchmarks for survivor queen sperm viability metrics.</p>
            <a href="https://entomology.ces.ncsu.edu/apiculture/queen-quality-clinic/" target="_blank" rel="noreferrer" style={{ fontSize: '0.85em', color: '#60a5fa', textDecoration: 'none' }}>Clinic Data ↗</a>
          </div>
        </div>
      </aside>

      {/* HEADER: PILL SEARCH & TYPE TOGGLES */}
      <header className="z-[9999] bg-[#1a1a1a]/90 backdrop-blur-md p-4 border-b border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <input type="text" placeholder="Search notes..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)}
            className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm border border-white/20 outline-none focus:border-yellow-500" />
          <div className="bg-yellow-500/20 text-yellow-500 px-3 py-2 rounded-full text-[10px] font-black border border-yellow-500/30">
            {viewableCount} / {ALL_DATA.length}
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {['Tree', 'Mound', 'Building', 'Beehive'].map(cat => (
            <button key={cat} onClick={() => {
              const newCats = activeCategories.includes(cat) ? activeCategories.filter(c => c !== cat) : [...activeCategories, cat];
              setActiveCategories(newCats);
            }}
              className={\`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all \${activeCategories.includes(cat) ? 'bg-white text-black border-white' : 'bg-black/50 text-gray-500 border-white/5'}\`}>
              {cat}
            </button>
          ))}
        </div>
        
        {/* V77 GENETIC TOGGLES */}
        <div className="flex gap-2 mt-3">
           <button onClick={() => setGeneticFilter('All')} className={\`flex-1 py-1.5 rounded-full text-[10px] font-bold border transition-all \${geneticFilter === 'All' ? 'bg-blue-500 text-white border-blue-400' : 'bg-black/50 text-gray-400 border-white/10'}\`}>All</button>
           <button onClick={() => setGeneticFilter('Feral')} className={\`flex-1 py-1.5 rounded-full text-[10px] font-bold border transition-all \${geneticFilter === 'Feral' ? 'bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/20' : 'bg-black/50 text-gray-400 border-white/10'}\`}>🧬 Feral</button>
           <button onClick={() => setGeneticFilter('Managed')} className={\`flex-1 py-1.5 rounded-full text-[10px] font-bold border transition-all \${geneticFilter === 'Managed' ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20' : 'bg-black/50 text-gray-400 border-white/10'}\`}>🐝 Managed</button>
        </div>
      </header>

      <main className="flex-1 relative">
        {ALL_DATA.length > 0 && <MapComponent hives={filteredHives} />}
      </main>

      {/* FOOTER CONTROLS */}
      <footer className="z-[9999] bg-[#1a1a1a]/95 backdrop-blur-xl border-t border-white/10 p-4 pb-[env(safe-area-inset-bottom)] flex items-center justify-between gap-4">
        <button onClick={() => setSidebarOpen(true)} className="text-xl opacity-80 cursor-pointer">☰</button>
        <div className="flex-1 relative">
          <input type="text" placeholder="Zipcode..." className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs outline-none focus:border-yellow-500" />
          <span className="absolute right-3 top-2.5 opacity-30">📍</span>
        </div>
        <div className="flex gap-2">
            <button className="w-4 h-4 rounded-full border-2 bg-green-500 border-green-300" />
            <button className="w-4 h-4 rounded-full border-2 bg-yellow-500 border-yellow-300" />
            <button className="w-4 h-4 rounded-full border-2 bg-red-500 border-red-300" />
        </div>
      </footer>
    </div>
  );
};

export default App;
`;
fs.writeFileSync(appPath, newApp);

const newMap = `import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import 'maplibre-gl/dist/maplibre-gl.css';

const ICONS = { TREE: '🌲', GROUND: '⛰️', BUILDING: '🏠', BEEHIVE: '🐝' };

const MapComponent = ({ hives }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);

  useEffect(() => {
    if (map.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => initMap([pos.coords.longitude, pos.coords.latitude]),
      () => initMap([-78.6382, 35.7796]), // Fallback to Raleigh, NC
      { enableHighAccuracy: true }
    );

    function initMap(center) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
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
        map.current.addLayer({ id: 'rl', type: 'line', source: 'rings', paint: { 'line-color': '#76ff03', 'line-width': 1, 'line-opacity': 0.2, 'line-dasharray': [2, 2] } });
      });
    }
  }, []);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach(m => m.remove());
    
    // V77 Geospatial Guard
    const validHives = hives.filter(h => Number.isFinite(Number(h.lng)) && Number.isFinite(Number(h.lat)));
    
    // Additive Overlays
    const ringData = validHives.map(h => turf.circle([Number(h.lng), Number(h.lat)], 3, { units: 'miles' }));
    if(map.current.getSource('rings')) map.current.getSource('rings').setData({ type: 'FeatureCollection', features: ringData });

    markers.current = validHives.map(hive => {
      const el = document.createElement('div');
      
      const note = (hive.note || "").toLowerCase();
      let type = 'BEEHIVE';
      if (/tree|pine|oak|snag|wood|forest/i.test(note)) type = 'TREE';
      else if (/ground|dirt|soil|earth|mound/i.test(note)) type = 'GROUND';
      else if (/building|house|wall|structure|roof|shed/i.test(note)) type = 'BUILDING';
      else if (/box|hive|nuc|feral|langstroth/i.test(note)) type = 'BEEHIVE';
      
      const health = hive.status === 'at-risk' || hive.status === 'atRisk' ? '#ff1744' : hive.status === 'warning' ? '#ff9100' : '#ffffff';
      
      el.style.cssText = \`display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:4px; background:white; border:2px solid \${health}; box-shadow:0 4px 10px rgba(0,0,0,0.5); cursor:pointer; font-size:14px;\`;
      el.innerText = ICONS[type];

      const p = new maplibregl.Popup({ offset: 12, closeOnClick: true }).setHTML(\`<div style="color:black; padding:8px; font-weight:bold;">\${hive.date || '2026'}<br/>\${hive.note}</div>\`);
      
      return new maplibregl.Marker({ element: el })
        .setLngLat([Number(hive.lng), Number(hive.lat)]) // Final Geospatial Array Enforcement Guard
        .setPopup(p).addTo(map.current);
    });
  }, [hives]);

  return <div ref={mapContainer} className="w-full h-full relative" />;
};

export default MapComponent;
`;
fs.writeFileSync(mapPath, newMap);

console.log("V77 Master Override Complete.");
