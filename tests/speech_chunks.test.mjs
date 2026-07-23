import test from 'node:test';
import assert from 'node:assert/strict';

import { splitIntoSpeechChunks, SPEECH_CHUNK_LIMIT } from '../scripts/speech_chunks.mjs';

test('laisse un texte court en un seul énoncé', () => {
  assert.deepEqual(splitIntoSpeechChunks('Calculer la vitesse.'), ['Calculer la vitesse.']);
});

test('renvoie une liste vide pour un texte vide', () => {
  assert.deepEqual(splitIntoSpeechChunks('   '), []);
});

test('découpe un texte long en morceaux sous la limite sans perdre de mot', () => {
  const sentence = 'Analyser les documents fournis et proposer une solution argumentée. ';
  const text = sentence.repeat(8).trim();
  const chunks = splitIntoSpeechChunks(text);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= SPEECH_CHUNK_LIMIT, `morceau trop long : ${chunk.length}`);
  }

  const rejoined = chunks.join(' ').replace(/\s+/gu, ' ').trim();
  const expected = text.replace(/\s+/gu, ' ').trim();
  assert.equal(rejoined, expected);
});

test('découpe une phrase unique plus longue que la limite', () => {
  const word = 'a'.repeat(50);
  const text = `${word} ${word} ${word} ${word} ${word} ${word}`;
  const chunks = splitIntoSpeechChunks(text, 60);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 60);
  }
});

test('coupe un mot unique plus long que la limite', () => {
  const chunks = splitIntoSpeechChunks('x'.repeat(250));

  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= SPEECH_CHUNK_LIMIT);
  }
});
