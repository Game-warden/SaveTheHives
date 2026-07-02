const fs = require('fs');

const sqlContent = fs.readFileSync('honeybee1.sql', 'utf8');
const lines = sqlContent.split('\n');

const legacyData = [
  { latitude: 35.7500, longitude: -79.0100, type: "Live Tree", notes: "Sample Feral Colony" },
  { latitude: 35.7521, longitude: -79.0123, type: "Building", notes: "In the eaves of the old barn" },
  { latitude: 35.7890, longitude: -78.9567, type: "Manmade Structure", notes: "Inside a hollow fence post" }
];

const insertRegex = /INSERT INTO `honeybee1` VALUES \((.+)\);/;

for (const line of lines) {
    const match = line.match(insertRegex);
    if (match) {
        let dataStr = match[1];
        let values = [];
        let currentVal = '';
        let inQuotes = false;
        
        for (let i = 0; i < dataStr.length; i++) {
            const char = dataStr[i];
            if (char === "'" && (i === 0 || dataStr[i - 1] !== '\\')) {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentVal.trim());
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        values.push(currentVal.trim());

        // Extract fields
        // [0] timestamp
        // [1] identity/id
        // [2] longitude
        // [3] latitude
        // [4] description (notes)
        // [5] hivetype (type)

        if (values.length >= 6) {
            let lon = parseFloat(values[2]);
            let lat = parseFloat(values[3]);
            let notes = values[4] || '';
            let type = values[5] || '';

            if (type.startsWith("'") && type.endsWith("'")) {
                type = type.substring(1, type.length - 1);
            }
            if (notes.startsWith("'") && notes.endsWith("'")) {
                notes = notes.substring(1, notes.length - 1);
            } else if (notes === 'NULL') {
                notes = '';
            }

            notes = notes.replace(/\\'/g, "'").replace(/"/g, '\\"');
            
            // Validate numbers
            if (!isNaN(lat) && !isNaN(lon)) {
                legacyData.push({ latitude: lat, longitude: lon, type: type, notes: notes });
            }
        }
    }
}

const jsContent = `// src/legacy-data.js
export const legacyData = [
${legacyData.map(d => `  { latitude: ${d.latitude}, longitude: ${d.longitude}, type: "${d.type}", notes: "${d.notes}" }`).join(',\n')}
];
`;

fs.writeFileSync('src/legacy-data.js', jsContent);
console.log(`Successfully parsed ${legacyData.length} records and wrote to src/legacy-data.js`);
