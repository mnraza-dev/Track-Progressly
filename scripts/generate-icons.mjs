import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = '/Volumes/Dev/Apps/progressly/public/icons';

// Use a dark theme color - #1a1a1a as suggested
const backgroundColor = '#1a1a1a';
const accentColor = '#3b82f6'; // blue accent

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, size, size);

  // Draw a simple rounded square in the center
  const margin = size * 0.15;
  const innerSize = size - margin * 2;
  const radius = innerSize * 0.2;

  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.roundRect(margin, margin, innerSize, innerSize, radius);
  ctx.fill();

  // Add a simple "P" for Progressly
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${innerSize * 0.5}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', size / 2, size / 2 + innerSize * 0.02);

  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(iconsDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${size}x${size})`);
}

console.log('All icons generated!');