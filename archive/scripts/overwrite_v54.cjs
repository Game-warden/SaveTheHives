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

// 2. V54 App.jsx Injection
const newApp = `import React, { useState, useMemo } from 'react';
import MapComponent from './components/MapComponent';

const ALL_DATA = ${hivesArrayStr};

const TYPE_DEFS = {
  TREE: { icon: '🌲', color: '#5D4037' },
  GROUND: { icon: '⛰️', color: '#8D6E63' },
  BUILDING: { icon: '🏠', color: '#455A64' },
  BEEHIVE: { icon: '🐝', color: '#FFD600' }
};

function App() {
  const [search, setSearch] = useState('');
  const [types, setTypes] = useState(['TREE', 'GROUND', 'BEEHIVE', 'BUILDING']);
  const [status, setStatus] = useState(['healthy', 'warning', 'atRisk']);
  const [counts, setCounts] = useState({ total: ALL_DATA.length, viewable: 0 });

  const filteredHives = useMemo(() => {
    return ALL_DATA.map(h => {
      // Logic Override: Trust the Note over the Metadata
      const noteLower = (h.note || "").toLowerCase();
      let realStatus = h.status;
      if (realStatus === 'warning' && (noteLower.includes('healthy') || noteLower.includes('strong'))) {
        realStatus = 'healthy';
      }
      return { ...h, status: realStatus };
    }).filter(h => {
      const note = (h.note || "").toLowerCase();
      let detected = 'BEEHIVE';
      if (note.includes('tree') || note.includes('pine') || note.includes('oak') || note.includes('snag') || note.includes('wood') || note.includes('forest')) detected = 'TREE';
      else if (note.includes('ground') || note.includes('dirt') || note.includes('soil') || note.includes('earth') || note.includes('mound')) detected = 'GROUND';
      else if (note.includes('building') || note.includes('house') || note.includes('wall') || note.includes('structure') || note.includes('roof') || note.includes('shed')) detected = 'BUILDING';

      return types.includes(detected) && status.includes(h.status) && 
             (!search || note.includes(search.toLowerCase())) && h.lng !== 0;
    });
  }, [search, types, status]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen bg-black text-white overflow-hidden font-sans">
      <header className="z-[999] bg-[#1a1a1a]/80 backdrop-blur-lg p-3 border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/5 rounded-full flex items-center px-4 py-2 border border-white/10">
            <span className="mr-2 opacity-50">🔍</span>
            <input 
              type="text" placeholder="Search notes..." 
              className="bg-transparent border-none outline-none text-sm w-full"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-[11px] font-black text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-full">
            {counts.viewable} / {ALL_DATA.length}
          </div>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto no-scrollbar">
          {Object.keys(TYPE_DEFS).map(t => (
            <button key={t} onClick={() => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
              className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all \${types.includes(t) ? 'bg-white text-black border-white shadow-lg' : 'bg-black/40 text-gray-500 border-white/5'}\`}>
              <span>{TYPE_DEFS[t].icon}</span> {t}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 relative">
        <MapComponent hives={filteredHives} onUpdate={setCounts} />
      </main>

      <footer className="z-[999] bg-[#1a1a1a]/95 backdrop-blur-xl border-t border-white/10 p-4 pb-[env(safe-area-inset-bottom)] flex items-center gap-4">
        <button className="text-xl opacity-50">☰</button>
        <div className="flex-1">
          <input type="text" placeholder="Zipcode..." className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs" />
        </div>
        <div className="flex gap-2">
          {['healthy', 'warning', 'atRisk'].map(s => (
            <button key={s} onClick={() => setStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
              className={\`w-4 h-4 rounded-full border-2 \${status.includes(s) ? (s==='healthy'?'bg-green-500 border-green-300':s==='warning'?'bg-yellow-500 border-yellow-300':'bg-red-500 border-red-300') : 'bg-transparent border-white/10'}\`} 
            />
          ))}
        </div>
      </footer>
    </div>
  );
}
export default App;
`;
fs.writeFileSync(appPath, newApp);

// 3. Update map component for Icon and Auto-Center
let mapStr = fs.readFileSync(mapPath, 'utf8');

// Swap the ground hole with the mound
mapStr = mapStr.replace(/GROUND:\s*'🕳'/, "GROUND: '⛰️'");

// Inject auto-locating on map load
if (!mapStr.includes('navigator.geolocation.getCurrentPosition(') || !mapStr.includes("map.current.on('load'")) {
    console.warn("Could not auto inject geolocation block.");
} else {
    // Add geolocation to the map load event
    const loadStr = `    map.current.on('load', () => {`;
    const replaceStr = `    map.current.on('load', () => {
      // V54 Auto-Geolocation Push
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          map.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12 });
        });
      }`;
    mapStr = mapStr.replace(loadStr, replaceStr);
}

fs.writeFileSync(mapPath, mapStr);

console.log("V54 Master App.jsx Override and Map Injection Complete.");
