import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../scripts/evalvoice.mjs', import.meta.url), 'utf8');

test('la page ne charge aucun script tiers et ne contient aucun gestionnaire inline', () => {
  assert.doesNotMatch(html, /https?:\/\/(?:cdnjs|unpkg|jsdelivr)/iu);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/iu);
  assert.doesNotMatch(html, /<script(?![^>]+src=)[^>]*>/iu);
});

test('tous les identifiants utilisés par le cache DOM existent dans la page', () => {
  const idsMatch = app.match(/const ids = \[([\s\S]*?)\];/u);
  assert.ok(idsMatch, 'La liste des identifiants doit rester détectable par ce test.');
  const ids = [...idsMatch[1].matchAll(/'([^']+)'/gu)].map((match) => match[1]);

  for (const id of ids) {
    assert.match(html, new RegExp(`id=["']${id}["']`, 'u'), `#${id} est absent`);
  }
});

test('la réponse est une zone multiligne et le sélecteur PDF reste accessible', () => {
  assert.match(html, /<textarea[\s\S]*?id="responseInput"/u);
  assert.match(html, /<input id="fileInput" type="file"/u);
  assert.doesNotMatch(html, /id="fileInput"[^>]+display\s*:\s*none/iu);
});
