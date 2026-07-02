const fs = require('fs');

const sqlContent = fs.readFileSync('honeybee1.sql', 'utf8');

const getHiveStatus = (note) => {
    note = (note || '').toLowerCase();
    if (note.includes('dead') || note.includes('removed') || note.includes('empty')) return 'warning';
    if (note.includes('risk') || note.includes('small') || note.includes('broken')) return 'atRisk';
    return 'healthy';
};

// Add the initial 3 from the legacy prompt, and give them a fake or null date. Wait, I should just give them "2010-01-01" or parse them out? 
// The user just wants the 1200 hives extracted with dates.
let allHives = [];

const insertRegex = /INSERT INTO `honeybee1` VALUES \(([\s\S]*?)\);/g;
let match;
let currentId = 1;

while ((match = insertRegex.exec(sqlContent)) !== null) {
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

    if (values.length >= 6) {
        let rawTimestamp = values[0] || '';
        let lon = parseFloat(values[2]);
        let lat = parseFloat(values[3]);
        let notes = values[4] || '';           // Using 'description' as 'note'
        let extraNotes = values[12] || '';     // Could also use 'notes'
        let type = values[5] || '';

        // Clean quotes
        if (rawTimestamp.startsWith("'") && rawTimestamp.endsWith("'")) {
            rawTimestamp = rawTimestamp.substring(1, rawTimestamp.length - 1);
        }
        if (type.startsWith("'") && type.endsWith("'")) {
            type = type.substring(1, type.length - 1);
        }
        if (notes.startsWith("'") && notes.endsWith("'")) {
            notes = notes.substring(1, notes.length - 1);
        } else if (notes === 'NULL') {
            notes = '';
        }

        notes = notes.replace(/\\'/g, "'").replace(/"/g, '\\"').replace(/\r\n|\n|\r/g, ' ');

        let fullNote = type ? `[${type}] ${notes}` : notes;

        let status = getHiveStatus(fullNote);
        let date = rawTimestamp ? rawTimestamp.split(' ')[0] : 'Unknown Date';

        if (!isNaN(lat) && !isNaN(lon)) {
            allHives.push({
                id: currentId++,
                lat: lat,
                lng: lon,
                status: status,
                note: fullNote.trim(),
                date: date
            });
        }
    }
}

const jsContent = `export const allHives = ${JSON.stringify(allHives, null, 2)};\n`;
fs.writeFileSync('src/hiveData.js', jsContent);
console.log(`Successfully parsed ${allHives.length} records with actual dates and wrote to src/hiveData.js`);
