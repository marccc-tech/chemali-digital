const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, 'favicon.svg'));

const sizes = [
  { name: 'favicon-16.png',          size: 16  },
  { name: 'favicon-32.png',          size: 32  },
  { name: 'favicon-48.png',          size: 48  },
  { name: 'favicon-192.png',         size: 192 },
  { name: 'favicon-512.png',         size: 512 },
  { name: 'apple-touch-icon.png',    size: 180 },
];

(async () => {
  for (const { name, size } of sizes) {
    await sharp(svg, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, name));
    console.log('wrote', name);
  }
})();
