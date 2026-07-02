const fs = require('fs');

const appPath = './src/App.jsx';
const appContent = fs.readFileSync(appPath, 'utf8');

const startIndex = appContent.indexOf('function App() {');
if (startIndex === -1) {
    console.error("Could not find function App() {");
    process.exit(1);
}

const headerContent = appContent.substring(0, Math.max(0, appContent.indexOf('const TYPE_COLORS') !== -1 ? appContent.indexOf('const TYPE_COLORS') : startIndex));

const newAppFn = `
const TYPE_COLORS = {
  TREE: '#5D4037', GROUND: '#BF360C', BUILDING: '#455A64', BEEHIVE: '#FFD600'
};

function App() {
  const [searchNote, setSearchNote] = useState('');
  const [activeTypes, setActiveTypes] = useState(['TREE', 'GROUND', 'BEEHIVE', 'BUILDING']);
  const [activeStatus, setActiveStatus] = useState(['healthy', 'warning', 'at-risk']);
  const [counts, setCounts] = useState({ total: INJECTED_HIVES.length, viewable: 0 });

  const filteredHives = useMemo(() => {
    return INJECTED_HIVES.filter(h => {
      const typeStr = h.note?.toUpperCase() || "";
      let type = 'BEEHIVE';
      if (typeStr.includes('[TREE]')) type = 'TREE';
      else if (typeStr.includes('[GROUND]')) type = 'GROUND';
      else if (typeStr.includes('[BUILDING]')) type = 'BUILDING';
      
      return activeTypes.includes(type) && activeStatus.includes(h.status) && 
             (!searchNote || h.note?.toLowerCase().includes(searchNote.toLowerCase()));
    });
  }, [searchNote, activeTypes, activeStatus]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen bg-[#121212]">
      <header className="z-[999999] bg-[#2D2D2D] text-white p-3 shadow-2xl border-b-4 border-yellow-500 relative">
        <div className="flex justify-between items-center text-[11px] font-black mb-3">
          <span className="bg-yellow-500 text-black px-2 py-0.5 rounded">HIVES: {INJECTED_HIVES.length}</span>
          <span className="bg-white/10 px-2 py-0.5 rounded">VISIBLE: {counts.viewable}</span>
        </div>
        
        <input 
          type="text" placeholder="SEARCH NOTES..." 
          className="w-full bg-white text-black p-2 rounded text-sm mb-3 font-bold focus:ring-4 ring-yellow-500/50 outline-none"
          onChange={(e) => setSearchNote(e.target.value)}
        />

        {/* INSTANT-FEEDBACK BUTTONS WITH V46 COLOR SWATCHES */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
            {Object.keys(TYPE_COLORS).map(t => (
              <button key={t} onClick={() => setActiveTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                className={\`flex items-center justify-center gap-1.5 flex-1 py-2 rounded text-[10px] font-black border-2 transition-all \${activeTypes.includes(t) ? 'bg-white text-black border-yellow-500 shadow-lg scale-105' : 'bg-transparent text-white/50 border-white/20'}\`}>
                <span className="w-2.5 h-2.5 rounded-full inline-block shadow-inner" style={{ backgroundColor: TYPE_COLORS[t], border: '1px solid rgba(0,0,0,0.2)' }}></span> 
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {['healthy', 'warning', 'at-risk'].map(s => (
              <button key={s} onClick={() => setActiveStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
                className={\`flex-1 py-1.5 rounded text-[9px] font-black border capitalize transition-all \${activeStatus.includes(s) ? 'bg-white text-black border-white' : 'bg-transparent text-white/30 border-white/10'}\`}>
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
console.log("App.jsx updated with V46 Color-Coded App function successfully!");
