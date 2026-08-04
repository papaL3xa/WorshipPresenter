const fs = require('fs');
let data = fs.readFileSync('frontend/scripts/update_songs.json', 'utf8');
data = data.replace('\\ Akan kering lautan.', '\\nAkan kering lautan.');
fs.writeFileSync('frontend/scripts/update_songs.json', data);
console.log('Fixed JSON');
