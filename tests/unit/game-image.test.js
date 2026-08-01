import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGameImageUrl } from '../../services/game-image.service.js';

test('un logo importé reste prioritaire', () => {
  assert.equal(resolveGameImageUrl({
    name: 'Frostgrave',
    imageUrl: '/uploads/games/custom.webp',
  }), '/uploads/games/custom.webp');
});

test('les noms de jeux utilisent leur logo statique', () => {
  assert.equal(resolveGameImageUrl({ name: '  WARHAMMER   40000  ' }), '/images/games/warhammer-40000.webp');
  assert.equal(resolveGameImageUrl({ name: 'Jeu sans logo' }), null);
});
