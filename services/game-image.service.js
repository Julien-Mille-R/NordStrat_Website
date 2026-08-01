const STATIC_GAME_IMAGES = new Map([
  ['blood bowl', '/images/games/blood-bowl.jpg'],
  ['ember obsidian protocol', '/images/games/ember-obsidian-protocol.png'],
  ['frostgrave', '/images/games/frostgrave.png'],
  ['marvel crisis protocol', '/images/games/marvel-crisis-protocol.png'],
  ['rangers of shadow deep', '/images/games/rangers-of-shadow-deep.png'],
  ['star wars legion', '/images/games/star-wars-legion.png'],
  ['stargrave', '/images/games/stargrave.webp'],
  ['warhammer 40000', '/images/games/warhammer-40000.webp'],
  ['warhammer age of sigmar', '/images/games/warhammer-age-of-sigmar.webp'],
  ['warhammer the old world', '/images/games/warhammer-the-old-world.png'],
]);

function normalizedGameName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
}

export function resolveGameImageUrl(game) {
  if (!game) return null;
  return game.imageUrl || STATIC_GAME_IMAGES.get(normalizedGameName(game.name)) || null;
}

export function attachGameImageUrl(game) {
  if (game) game.displayImageUrl = resolveGameImageUrl(game);
  return game;
}
