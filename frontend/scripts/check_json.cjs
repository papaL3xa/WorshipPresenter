const fs = require('fs');
try {
  const data = fs.readFileSync('frontend/scripts/update_songs.json', 'utf8');
  JSON.parse(data);
} catch (e) {
  console.log(e.message);
  const match = e.message.match(/position (\d+)/);
  if (match) {
    const pos = parseInt(match[1]);
    const data = fs.readFileSync('frontend/scripts/update_songs.json', 'utf8');
    console.log("Context: ");
    console.log(data.substring(pos - 50, pos + 50));
  }
}
