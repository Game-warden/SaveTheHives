const fs = require('fs');

const manifestPath = 'src/App.jsx';
let content = fs.readFileSync(manifestPath, 'utf8');

const targetIds = [4, 6, 23, 54, 68, 78, 125, 141, 146, 211, 543, 564, 609, 810];
let modifiedCount = 0;

targetIds.forEach(id => {
    // Regex effectively finds "id": [ID] and looks forward to find the next "note": "[content]"
    const regex = new RegExp(`("id":\\s*${id}\\s*,[\\s\\S]*?"note":\\s*")([^"]*?)(")`, "g");
    content = content.replace(regex, (match, p1, p2, p3) => {
        modifiedCount++;
        return p1 + p2 + (p2.endsWith(' ') ? '' : ' ') + "[healthy]" + p3;
    });
});

fs.writeFileSync(manifestPath, content);
console.log(`Successfully appended [healthy] tag to ${modifiedCount} hive notes in App.jsx.`);
