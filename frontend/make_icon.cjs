const { Jimp } = require('jimp');

async function main() {
  const img = await Jimp.read('icon.png');
  const size = Math.max(img.bitmap.width, img.bitmap.height);
  
  // Create background with dark navy blue color (#1a2744) matching the logo
  const bg = new Jimp({ width: size, height: size, color: 0x1a2744ff });
  
  // Composite logo centered on background
  const x = Math.floor((size - img.bitmap.width) / 2);
  const y = Math.floor((size - img.bitmap.height) / 2);
  bg.composite(img, x, y);
  
  // Resize to 256x256 for ico
  bg.resize({ w: 256, h: 256 });
  await bg.write('icon_square.png');
  console.log('Done - icon with background created');
}

main().catch(console.error);
