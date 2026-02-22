import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const assetsDir = resolve(root, 'assets');
const sourceIcon = resolve(assetsDir, 'icon-trackit.svg');

const outputs = [
  { file: 'icon.png', size: 1024 },
  { file: 'adaptive-icon.png', size: 1024 },
  { file: 'favicon.png', size: 48 },
  { file: 'notification-icon.png', size: 96 },
];

await mkdir(assetsDir, { recursive: true });

for (const output of outputs) {
  await sharp(sourceIcon)
    .resize(output.size, output.size)
    .png()
    .toFile(resolve(assetsDir, output.file));
}

console.log(`Generated ${outputs.length} icons from assets/icon-trackit.svg`);
