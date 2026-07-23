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

test('préserve les décimales et ratios dans une tâche complexe longue', () => {
  const paragraph = [
    'Analyser les mesures et expliciter chaque étape du raisonnement.',
    'Utiliser g = 9.81 m/s² et le rapport 1:2 pour effectuer le calcul final.',
    'Conclure en comparant la valeur obtenue au modèle proposé.'
  ].join(' ');
  const text = `${paragraph} `.repeat(3).trim();
  const normalized = text.replace(/\s+/gu, ' ').trim();
  const chunks = splitIntoSpeechChunks(text, 90);

  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(' '), normalized);
  assert.ok(chunks.some((chunk) => chunk.includes('9.81')));
  assert.ok(chunks.some((chunk) => chunk.includes('1:2')));
});

test('remplace une limite fractionnaire invalide par la limite sûre', () => {
  const chunks = splitIntoSpeechChunks('x'.repeat(250), 0.5);

  assert.equal(chunks.length, 2);
  assert.ok(chunks.every((chunk) => chunk.length <= SPEECH_CHUNK_LIMIT));
});
