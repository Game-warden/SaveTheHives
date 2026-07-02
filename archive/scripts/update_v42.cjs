const fs = require('fs');

const appPath = './src/App.jsx';
const appContent = fs.readFileSync(appPath, 'utf8');

// Find the start of function App() {
const startIndex = appContent.indexOf('function App() {');

if (startIndex === -1) {
    console.error("Could not find function App() {");
    process.exit(1);
}

const headerContent = appContent.substring(0, startIndex);

const newAppFn = `function App() {
  const [searchNote, setSearchNote] = useState('');
  const [activeTypes, setActiveTypes] = useState(['TREE', 'GROUND', 'BEEHIVE', 'BUILDING']);
  const [activeStatus, setActiveStatus] = useState(['healthy', 'warning', 'at-risk']);
  const [counts, setCounts] = useState({ total: INJECTED_HIVES.length, viewable: 0 });

  console.log("V42 DATA LOADED WITH STATUS FILTERS:", INJECTED_HIVES.length);

  const filteredHives = useMemo(() => {
    return INJECTED_HIVES.filter(h => {
      const typeStr = h.note?.toUpperCase() || "";
      let type = 'BEEHIVE';
      if (typeStr.includes('[TREE]')) type = 'TREE';
      else if (typeStr.includes('[GROUND]')) type = 'GROUND';
      else if (typeStr.includes('[BUILDING]')) type = 'BUILDING';
      
      const typeMatch = activeTypes.includes(type);
      const statusMatch = activeStatus.includes(h.status);
      const noteMatch = !searchNote || h.note?.toLowerCase().includes(searchNote.toLowerCase());
      return typeMatch && statusMatch && noteMatch;
    });
  }, [searchNote, activeTypes, activeStatus]);

  return (
    <div id="app-root" className="fixed inset-0 overflow-hidden flex flex-col h-screen bg-[#1a1a1a]">
      <header className="z-[999999] bg-[#4a3f2f] text-white p-3 shadow-xl border-b-2 border-amber-500 relative">
        <div className="flex justify-between items-center text-[10px] font-black tracking-tighter mb-2">
          <span className="text-amber-400">HIVES: {INJECTED_HIVES.length}</span>
          <span className="text-white">VISIBLE: {counts.viewable}</span>
        </div>
        <input 
          type="text" 
          placeholder="SEARCH NOTES..." 
          className="w-full bg-white text-black p-2 rounded text-xs mb-2 font-bold shadow-inner"
          onChange={(e) => setSearchNote(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {['TREE', 'GROUND', 'BEEHIVE', 'BUILDING'].map(t => (
              <button key={t} onClick={() => setActiveTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                className={\`px-2 py-1 rounded text-[9px] font-black border \${activeTypes.includes(t) ? 'bg-amber-400 text-black border-amber-600' : 'bg-transparent text-white/40 border-white/20'}\`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {['healthy', 'warning', 'at-risk'].map(s => (
              <button key={s} onClick={() => setActiveStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
                className={\`px-2 py-1 rounded text-[9px] font-black border capitalize \${activeStatus.includes(s) ? 'bg-white text-black border-gray-400' : 'bg-transparent text-white/40 border-white/20'}\`}>
                {s}
              </button>
            ))}
          </div>
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

fs.writeFileSync(appPath, headerContent + newAppFn);
console.log("App.jsx updated with V42 App function successfully!");
