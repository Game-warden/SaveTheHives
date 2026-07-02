const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/App.jsx');
const mapPath = path.join(__dirname, '../src/components/MapComponent.jsx');

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

const newApp = `import React, { useState, useMemo, useEffect } from 'react';
import MapComponent from './components/MapComponent';

const ALL_DATA = ${hivesArrayStr};

const TYPE_CONFIG = {
  TREE: '🌲', GROUND: '⛰️', BUILDING: '🏠', BEEHIVE: '🐝'
};

function App() {
  const [search, setSearch] = useState('');
  const [zip, setZip] = useState('');
  const [targetCoords, setTargetCoords] = useState(null);
  
  // V72: Persistence Loading
  const loadState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem('hiveSettings_' + key);
      return saved ? JSON.parse(saved) : defaultVal;
    } catch(e) { return defaultVal; }
  };

  const [types, setTypes] = useState(() => loadState('types', ['TREE', 'GROUND', 'BEEHIVE', 'BUILDING']));
  const [status, setStatus] = useState(() => loadState('status', ['healthy', 'warning', 'at-risk']));
  const [geneticFilter, setGeneticFilter] = useState(() => loadState('genetic', 'All'));
  const [counts, setCounts] = useState({ total: ALL_DATA.length, viewable: 0 });

  // V72: Persistence Saving
  useEffect(() => { localStorage.setItem('hiveSettings_types', JSON.stringify(types)); }, [types]);
  useEffect(() => { localStorage.setItem('hiveSettings_status', JSON.stringify(status)); }, [status]);
  useEffect(() => { localStorage.setItem('hiveSettings_genetic', JSON.stringify(geneticFilter)); }, [geneticFilter]);

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

      // V72: Genetic Toggle Filter Logic
      const isFeral = /tree|building|feral/i.test(note) && !/box|langstroth|managed/i.test(note);
      const matchesGenetics = geneticFilter === 'All' || 
                             (geneticFilter === 'Feral' && isFeral) || 
                             (geneticFilter === 'Managed' && !isFeral);

      return types.includes(t) && status.includes(h.status) && matchesGenetics && 
             (!search || note.includes(search.toLowerCase())) && h.lng !== 0;
    });
  }, [search, types, status, geneticFilter]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen bg-black text-white font-sans overflow-hidden">
      <header className="z-[9999] bg-[#1a1a1a]/95 backdrop-blur-xl p-4 border-b border-white/10 shadow-2xl pt-[env(safe-area-inset-top)] flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Search notes..." value={search} onChange={(e)=>setSearch(e.target.value)}
            className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm border border-white/20 outline-none focus:border-yellow-500" />
          <div className="bg-yellow-500/20 text-yellow-500 px-3 py-2 rounded-full text-[10px] font-black border border-yellow-500/30">
            {counts.viewable} / {ALL_DATA.length}
          </div>
        </div>
        
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {Object.keys(TYPE_CONFIG).map(t => (
            <button key={t} onClick={() => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
              className={\`flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all \${types.includes(t) ? 'bg-white text-black border-white' : 'bg-black/50 text-gray-500 border-white/5'}\`}>
              <span>{TYPE_CONFIG[t]}</span> {t}
            </button>
          ))}
        </div>
        
        {/* V72 GENETIC TOGGLES */}
        <div className="flex gap-2">
           <button onClick={() => setGeneticFilter('All')} className={\`flex-1 py-1.5 rounded-full text-[10px] font-bold border transition-all \${geneticFilter === 'All' ? 'bg-blue-500 text-white border-blue-400' : 'bg-black/50 text-gray-400 border-white/10'}\`}>All</button>
           <button onClick={() => setGeneticFilter('Feral')} className={\`flex-1 py-1.5 rounded-full text-[10px] font-bold border transition-all \${geneticFilter === 'Feral' ? 'bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/20' : 'bg-black/50 text-gray-400 border-white/10'}\`}>🧬 Feral</button>
           <button onClick={() => setGeneticFilter('Managed')} className={\`flex-1 py-1.5 rounded-full text-[10px] font-bold border transition-all \${geneticFilter === 'Managed' ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20' : 'bg-black/50 text-gray-400 border-white/10'}\`}>🐝 Managed</button>
        </div>
      </header>

      <main className="flex-1 relative">
        {ALL_DATA.length > 0 && <MapComponent hives={filteredHives} onUpdate={setCounts} flyTo={targetCoords} />}
      </main>

      <footer className="z-[9999] bg-[#1a1a1a]/95 backdrop-blur-xl border-t border-white/10 p-4 pb-[env(safe-area-inset-bottom)] flex items-center gap-4">
        <button onClick={() => alert('Menu Open')} className="text-xl opacity-60">☰</button>
        <div className="flex-1 relative">
          <input type="text" placeholder="Zipcode..." className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs outline-none focus:border-yellow-500"
            value={zip} onChange={(e) => setZip(e.target.value)} onKeyDown={handleZipSearch} />
          <span className="absolute right-3 top-2.5 opacity-30">📍</span>
        </div>
        <div className="flex gap-2">
          {['healthy', 'warning', 'at-risk'].map(s => (
            <button key={s} onClick={() => setStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
              className={\`w-5 h-5 rounded-full border-2 transition-all \${status.includes(s) ? (s==='healthy'?'bg-green-500 border-green-300':s==='warning'?'bg-yellow-500 border-yellow-300':'bg-red-500 border-red-300') : 'bg-transparent border-white/10'}\`} />
          ))}
        </div>
      </footer>
    </div>
  );
}
export default App;
`;

fs.writeFileSync(appPath, newApp);

let mapStr = fs.readFileSync(mapPath, 'utf8');

if (!mapStr.includes('flyTo')) {
    mapStr = mapStr.replace('export default function MapComponent({ hives, onUpdate })', 'export default function MapComponent({ hives, onUpdate, flyTo })');
    mapStr = mapStr.replace("  useEffect(() => {\\n    if (!isMapLoaded", "  useEffect(() => {\\n    if (map.current && flyTo) map.current.flyTo({ center: flyTo, zoom: 14 });\\n  }, [flyTo]);\\n\\n  useEffect(() => {\\n    if (!isMapLoaded");
}

fs.writeFileSync(mapPath, mapStr);
console.log("V72 Overwrite Applied.");
