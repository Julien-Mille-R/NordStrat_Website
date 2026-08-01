const PUBLIC_DEFAULT_AVATAR_PREFIX = '/images/default-avatars/';

const avatarPresets = [
  ['braise', 'Braise', 'nord-strategie-braise', '8f3f20'],
  ['rune', 'Rune', 'nord-strategie-rune', '503a65'],
  ['comete', 'Comète', 'nord-strategie-comete', '1f5d73'],
  ['griffon', 'Griffon', 'nord-strategie-griffon', '765c26'],
  ['gobelin', 'Gobelin', 'nord-strategie-gobelin', '536b32'],
  ['dragon', 'Dragon', 'nord-strategie-dragon', '7b2d32'],
  ['sentinelle', 'Sentinelle', 'nord-strategie-sentinelle', '36475c'],
  ['alchimiste', 'Alchimiste', 'nord-strategie-alchimiste', '62502a'],
  ['tempete', 'Tempête', 'nord-strategie-tempete', '28556b'],
  ['phoenix', 'Phénix', 'nord-strategie-phoenix', '9a4b22'],
  ['oracle', 'Oracle', 'nord-strategie-oracle', '67406d'],
  ['vagabond', 'Vagabond', 'nord-strategie-vagabond', '4d5a3a'],
].map(([id, label, seed, backgroundColor]) => Object.freeze({
  id,
  label,
  seed,
  backgroundColor,
  url: `${PUBLIC_DEFAULT_AVATAR_PREFIX}${id}.svg`,
}));

export const DEFAULT_AVATARS = Object.freeze(avatarPresets);

export function findDefaultAvatar(avatarId) {
  return DEFAULT_AVATARS.find((avatar) => avatar.id === avatarId) || null;
}
