const sharp = require('sharp');
const fs = require('fs');

const svgBuffer = fs.readFileSync('./public/favicon.svg');

sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile('./public/apple-touch-icon.png')
  .then(() => console.log('apple-touch-icon.png created'))
  .catch(console.error);
