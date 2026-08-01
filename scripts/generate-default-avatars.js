import fs from 'node:fs/promises';
import path from 'node:path';
import { Avatar, Style } from '@dicebear/core';
import pixelArtDefinition from '@dicebear/styles/pixel-art.json' with { type: 'json' };
import { DEFAULT_AVATARS } from '../services/default-avatar.service.js';

const outputDirectory = path.join(process.cwd(), 'public', 'images', 'default-avatars');
const pixelArtStyle = new Style(pixelArtDefinition);

await fs.mkdir(outputDirectory, { recursive: true });

await Promise.all(DEFAULT_AVATARS.map(async (avatar) => {
  const svg = new Avatar(pixelArtStyle, {
    seed: avatar.seed,
    size: 256,
    backgroundColor: [avatar.backgroundColor],
  }).toString();
  await fs.writeFile(path.join(outputDirectory, `${avatar.id}.svg`), svg, {
    encoding: 'utf8',
    mode: 0o644,
  });
}));

console.log(`${DEFAULT_AVATARS.length} avatars DiceBear générés dans public/images/default-avatars.`);
