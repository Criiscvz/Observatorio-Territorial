const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, '..', 'public', 'ULEAM.png');
const outputDir = path.join(__dirname, '..', 'src', 'icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('Generating PWA icons from', inputFile);
  
  for (const size of sizes) {
    const outputFile = path.join(outputDir, `icon-${size}x${size}.png`);
    await sharp(inputFile)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 15, g: 23, b: 42, alpha: 1 }, // #0F172A dark bg
      })
      .png()
      .toFile(outputFile);
    console.log(`✓ icon-${size}x${size}.png`);
  }

  // Maskable icon (512x512 with padding for safe zone)
  const maskableFile = path.join(outputDir, 'icon-512x512-maskable.png');
  await sharp(inputFile)
    .resize(410, 410, { // ~80% of 512 for safe zone
      fit: 'contain',
      background: { r: 99, g: 102, b: 241, alpha: 0 },
    })
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: { r: 99, g: 102, b: 241, alpha: 1 }, // #6366F1 indigo
    })
    .png()
    .toFile(maskableFile);
  console.log('✓ icon-512x512-maskable.png (maskable)');

  console.log('\n✅ All PWA icons generated in src/icons/');
}

generateIcons().catch(console.error);
