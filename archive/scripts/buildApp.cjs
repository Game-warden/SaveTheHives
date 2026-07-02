const fs = require('fs');

const hiveDataStr = fs.readFileSync('./src/hiveData.js', 'utf8').replace('export const allHives = ', '').trim();

const appJsxContent = `import React, { useState, useMemo } from 'react';
import MapComponent from './components/MapComponent';

// DIRECT INJECTION: Agent will paste all 1162 hives here
const INJECTED_HIVES = ${hiveDataStr};

function App() {
  const [searchNote, setSearchNote] = useState('');
  const [activeTypes, setActiveTypes] = useState(['TREE', 'GROUND', 'BEEHIVE', 'BUILDING']);
  const [counts, setCounts] = useState({ total: INJECTED_HIVES.length, viewable: 0 });

  console.log("V41 DATA LOADED:", INJECTED_HIVES.length); // LOOK FOR THIS IN CONSOLE

  const filteredHives = useMemo(() => {
    return INJECTED_HIVES.filter(h => {
      const typeStr = h.note?.toUpperCase() || "";
      let type = 'BEEHIVE';
      if (typeStr.includes('[TREE]')) type = 'TREE';
      else if (typeStr.includes('[GROUND]')) type = 'GROUND';
      else if (typeStr.includes('[BUILDING]')) type = 'BUILDING';
      
      const typeMatch = activeTypes.includes(type);
      const noteMatch = !searchNote || h.note?.toLowerCase().includes(searchNote.toLowerCase());
      return typeMatch && noteMatch;
    });
  }, [searchNote, activeTypes]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen bg-black">
      <header className="z-[999999] bg-[#4a3f2f] text-white p-4 shadow-2xl border-b-2 border-amber-500 relative">
        <div className="flex justify-between items-center font-black mb-4">
          <span className="text-amber-400">HIVES: {INJECTED_HIVES.length}</span>
          <span className="text-white">VISIBLE: {counts.viewable}</span>
        </div>
        <input 
          type="text" 
          placeholder="SEARCH NOTES..." 
          className="w-full bg-white text-black p-3 rounded font-bold mb-3 shadow-inner"
          onChange={(e) => setSearchNote(e.target.value)}
        />
        <div className="flex gap-2">
          {['TREE', 'GROUND', 'BEEHIVE', 'BUILDING'].map(t => (
            <button key={t} onClick={() => setActiveTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
              className={\`px-4 py-2 rounded text-[10px] font-black border-2 \${activeTypes.includes(t) ? 'bg-amber-400 border-amber-600 text-black' : 'bg-transparent border-white/20 text-white opacity-40'}\`}>
              {t}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 relative">
        <MapComponent hives={filteredHives} onUpdateCounts={setCounts} />
      </main>
    </div>
  );
}
export default App;
`;

fs.writeFileSync('./src/App.jsx', appJsxContent);
console.log('App.jsx has been updated with raw injected hives!');
