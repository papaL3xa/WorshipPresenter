import { Jimp } from 'jimp';

Jimp.read('icon.png').then(img => {
  const size = Math.max(img.bitmap.width, img.bitmap.height);
  const bg = new Jimp({ width: size, height: size, color: 0x00000000 });
  bg.composite(img, Math.floor((size - img.bitmap.width) / 2), Math.floor((size - img.bitmap.height) / 2));
  bg.resize({ w: 256, h: 256 });
  bg.write('icon_square.png');
  console.log('Done');
}).catch(console.error);
