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

// AGENT: Paste all 1162 hives here
const ALL_DATA = ${hivesArrayStr};

const TYPE_MAP = {
  TREE: ['tree', 'pine', 'oak', 'snag', 'wood'],
  GROUND: ['ground', 'dirt', 'earth'],
  BUILDING: ['building', 'structure', 'roof', 'wall'],
  BEEHIVE: ['box', 'hive', 'nuc', 'feral']
};

function App() {
  const [search, setSearch] = useState('');
  const [types, setTypes] = useState(['TREE', 'GROUND', 'BEEHIVE', 'BUILDING']);
  const [status, setStatus] = useState(['healthy', 'warning', 'at-risk']);
  const [counts, setCounts] = useState({ total: ALL_DATA.length, viewable: 0 });

  const filteredHives = useMemo(() => {
    return ALL_DATA.filter(h => {
      const note = (h.note || "").toLowerCase();
      
      // TYPE DETECTION
      let detected = 'BEEHIVE';
      if (TYPE_MAP.TREE.some(k => note.includes(k))) detected = 'TREE';
      else if (TYPE_MAP.GROUND.some(k => note.includes(k))) detected = 'GROUND';
      else if (TYPE_MAP.BUILDING.some(k => note.includes(k))) detected = 'BUILDING';

      // STRICT FILTER LOGIC (Fixes the Inversion Bug)
      const isTypeActive = types.includes(detected);
      const isStatusActive = status.includes(h.status);
      const isSearchMatch = !search || note.includes(search.toLowerCase());
      const isValidCoord = h.lng !== 0 && h.lat !== 0;

      return isTypeActive && isStatusActive && isSearchMatch && isValidCoord;
    });
  }, [search, types, status]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen bg-black text-white overflow-hidden">
      <header className="z-[999] bg-[#1a1a1a] p-4 border-b-2 border-yellow-500 shadow-2xl">
        <div className="flex justify-between items-center text-[10px] font-black mb-4">
          <span className="text-yellow-400">TOTAL: {\`\${ALL_DATA.length}\`}</span>
          <span className="bg-white/10 px-3 py-1 rounded-full border border-white/20">VISIBLE: {counts.viewable}</span>
        </div>
        <input 
          type="text" placeholder="FILTER NOTES..." 
          className="w-full bg-[#333] text-white p-3 rounded-lg mb-4 border border-white/10"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {Object.keys(TYPE_MAP).map(t => (
              <button key={t} onClick={() => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                className={\`flex-1 py-2 rounded border-2 text-[9px] font-black transition-all \${types.includes(t) ? 'bg-white text-black border-yellow-500 shadow-lg' : 'opacity-20 border-white/10'}\`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {['healthy', 'warning', 'at-risk'].map(s => (
              <button key={s} onClick={() => setStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
                className={\`flex-1 py-1.5 rounded text-[9px] font-black uppercase border-2 transition-all \${status.includes(s) ? (s==='healthy'?'bg-green-600':'bg-red-600') + ' text-white border-white' : 'opacity-20 border-white/10'}\`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1 relative">
        <MapComponent hives={filteredHives} onUpdate={setCounts} />
      </main>
    </div>
  );
}
export default App;
`;

fs.writeFileSync(appPath, newApp);
console.log("App.jsx overwritten.");
