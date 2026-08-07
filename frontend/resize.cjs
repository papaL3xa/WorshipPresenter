const Jimp = require('jimp');
Jimp.read('icon.png').then(img => {
  const size = Math.max(img.bitmap.width, img.bitmap.height);
  new Jimp(size, size, 0x00000000, (err, bg) => {
    bg.composite(img, (size - img.bitmap.width) / 2, (size - img.bitmap.height) / 2);
    bg.resize(256, 256).write('icon_square.png', () => {
      console.log('Done');
    });
  });
});
