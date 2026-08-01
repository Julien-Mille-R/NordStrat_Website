import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ejs from 'ejs';

function viewFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? viewFiles(entryPath) : entryPath.endsWith('.ejs') ? [entryPath] : [];
  });
}

test('toutes les vues EJS compilent', () => {
  const files = viewFiles(path.resolve('views'));
  assert.ok(files.length > 0);
  files.forEach((filename) => {
    assert.doesNotThrow(() => ejs.compile(fs.readFileSync(filename, 'utf8'), { filename }), filename);
  });
});

test('le gabarit commun contient les repères essentiels d’accessibilité et de SEO', () => {
  const header = fs.readFileSync(path.resolve('views/partials/header.ejs'), 'utf8');
  assert.match(header, /<html lang="fr">/);
  assert.match(header, /name="viewport"/);
  assert.match(header, /rel="canonical"/);
  assert.match(header, /href="#main-content"/);
  assert.match(header, /<main id="main-content"/);
  assert.match(header, /aria-label="Navigation principale"/);
});

test('les pages 404 et 500 disposent d’un titre principal', () => {
  for (const page of ['404.ejs', '500.ejs']) {
    const content = fs.readFileSync(path.resolve('views/layouts', page), 'utf8');
    assert.match(content, /<h1\b/, page);
  }
});
