import fs from 'fs';
const buf = fs.readFileSync('icon.png');
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
console.log(width + 'x' + height);
