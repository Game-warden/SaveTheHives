// audit_hives.js
const fs = require('fs');
const path = require('path');

// 1. Keywords from our V51 Logic
const TYPE_MAP = {
    TREE: ['tree', 'pine', 'oak', 'snag', 'wood', 'forest'],
    GROUND: ['ground', 'dirt', 'earth', 'soil', 'mound'],
    BUILDING: ['building', 'structure', 'house', 'roof', 'wall', 'shed'],
    BEEHIVE: ['box', 'hive', 'nuc', 'feral', 'langstroth']
};

try {
    // 2. Read App.jsx to get the 1162 hives
    const appFile = fs.readFileSync(path.join(__dirname, 'src/App.jsx'), 'utf8');
    const match = appFile.match(/const ALL_DATA = (\[[\s\S]*?\]);/);

    if (!match) {
        console.log("❌ Error: Could not find ALL_DATA array in App.jsx");
        process.exit(1);
    }

    const hives = JSON.parse(match[1]);
    const stats = { TREE: 0, GROUND: 0, BUILDING: 0, BEEHIVE: 0, TOTAL: hives.length };

    // 3. Categorize
    hives.forEach(h => {
        const note = (h.note || "").toLowerCase();
        let detected = 'BEEHIVE';

        if (TYPE_MAP.TREE.some(k => note.includes(k))) detected = 'TREE';
        else if (TYPE_MAP.GROUND.some(k => note.includes(k))) detected = 'GROUND';
        else if (TYPE_MAP.BUILDING.some(k => note.includes(k))) detected = 'BUILDING';

        stats[detected]++;
    });

    // 4. Output Results
    console.log("\n📊 SAVETHEHIVES_2 DATA AUDIT");
    console.log("============================");
    console.log(`🌲 TREES:     ${stats.TREE}`);
    console.log(`🕳 GROUND:    ${stats.GROUND}`);
    console.log(`🏠 BUILDINGS: ${stats.BUILDING}`);
    console.log(`🐝 BEEHIVES:  ${stats.BEEHIVE}`);
    console.log("----------------------------");
    console.log(`📈 TOTAL:     ${stats.TOTAL}`);
    console.log("============================\n");

} catch (e) {
    console.log("❌ Audit Failed:", e.message);
}
