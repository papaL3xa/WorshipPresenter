const { Jimp } = require('jimp');

async function main() {
  const img = await Jimp.read('icon.png');
  const size = Math.max(img.bitmap.width, img.bitmap.height);
  const finalSize = 256;
  const radius = 48; // rounded corner radius
  
  // Create white background
  const bg = new Jimp({ width: size, height: size, color: 0xffffffff });
  
  // Composite logo centered on white background
  const x = Math.floor((size - img.bitmap.width) / 2);
  const y = Math.floor((size - img.bitmap.height) / 2);
  bg.composite(img, x, y);
  
  // Resize to final size
  bg.resize({ w: finalSize, h: finalSize });
  
  // Apply rounded corners by making corner pixels transparent
  for (let px = 0; px < finalSize; px++) {
    for (let py = 0; py < finalSize; py++) {
      let cornerX = -1, cornerY = -1;
      
      // Top-left corner
      if (px < radius && py < radius) { cornerX = radius; cornerY = radius; }
      // Top-right corner
      else if (px >= finalSize - radius && py < radius) { cornerX = finalSize - radius - 1; cornerY = radius; }
      // Bottom-left corner
      else if (px < radius && py >= finalSize - radius) { cornerX = radius; cornerY = finalSize - radius - 1; }
      // Bottom-right corner
      else if (px >= finalSize - radius && py >= finalSize - radius) { cornerX = finalSize - radius - 1; cornerY = finalSize - radius - 1; }
      
      if (cornerX >= 0) {
        const dist = Math.sqrt((px - cornerX) ** 2 + (py - cornerY) ** 2);
        if (dist > radius) {
          // Outside the rounded corner - make transparent
          const idx = (py * finalSize + px) * 4;
          bg.bitmap.data[idx + 3] = 0; // set alpha to 0
        }
      }
    }
  }
  
  await bg.write('icon_square.png');
  console.log('Done - icon with white bg and rounded corners');
}

main().catch(console.error);
