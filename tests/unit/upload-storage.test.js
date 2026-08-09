import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deleteUploadedImage,
  uploadedImageExtension,
} from '../../services/upload-storage.service.js';

test('la signature réelle détermine le format de l’image', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const fakePng = Buffer.from('ceci nest pas une image');
  assert.equal(uploadedImageExtension(png), 'png');
  assert.equal(uploadedImageExtension(fakePng), null);
});

test('la suppression refuse toute sortie du sous-dossier autorisé', async () => {
  assert.equal(await deleteUploadedImage('/uploads/avatars/../news/image.png', 'avatars'), false);
  assert.equal(await deleteUploadedImage('/images/default-avatars/dragon.svg', 'avatars'), false);
});
