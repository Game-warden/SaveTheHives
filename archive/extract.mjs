import fs from 'fs';
import { legacyData } from './src/legacy-data.js';

const getHiveStatus = (hive) => {
    const note = (hive.notes || hive.desc || '').toLowerCase();
    if (note.includes('dead') || note.includes('removed') || note.includes('empty')) return 'warning';
    if (note.includes('risk') || note.includes('small') || note.includes('broken')) return 'atRisk';
    return 'healthy';
};

const allHives = legacyData.map((hive, index) => ({
    id: index + 1,
    lat: hive.latitude,
    lng: hive.longitude,
    status: getHiveStatus(hive),
    note: hive.notes || hive.desc || 'No historical notes available.',
    date: 'Legacy Record'
}));

const content = `export const allHives = ${JSON.stringify(allHives, null, 2)};\n`;
fs.writeFileSync('./src/hiveData.js', content, 'utf-8');
console.log("Successfully created src/hiveData.js with " + allHives.length + " hives.");
