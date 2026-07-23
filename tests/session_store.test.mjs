import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSessionStore,
  sessionStoreConfig
} from '../scripts/session_store.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

const validState = {
  evaluationTitle: 'Évaluation énergie',
  questions: ['Analyser les résultats.'],
  responses: ['Une réponse.'],
  currentQuestion: 0,
  studentName: 'Camille, 3e A',
  speechRate: 1.2,
  hasUnsavedWork: true
};

test('sauvegarde et restaure un état validé', () => {
  const storage = memoryStorage();
  const store = createSessionStore(storage, () => 1_000);

  assert.equal(store.save(validState), true);
  assert.deepEqual(store.load(), validState);
});

test('supprime une session expirée', () => {
  const storage = memoryStorage();
  let now = 1_000;
  const store = createSessionStore(storage, () => now);
  store.save(validState);

  now += sessionStoreConfig.maxAgeMs + 1;
  assert.equal(store.load(), null);
  assert.equal(storage.getItem(sessionStoreConfig.storageKey), null);
});

test('refuse les données corrompues', () => {
  const storage = memoryStorage();
  storage.setItem(sessionStoreConfig.storageKey, '{"version":2,"state":null}');
  const store = createSessionStore(storage, () => 1_000);

  assert.equal(store.load(), null);
});

test('borne la question courante et la vitesse', () => {
  const storage = memoryStorage();
  const store = createSessionStore(storage, () => 1_000);
  store.save({
    ...validState,
    currentQuestion: 999,
    speechRate: 12
  });

  const restored = store.load();
  assert.equal(restored.currentQuestion, 0);
  assert.equal(restored.speechRate, 2);
});

test('continue sans erreur quand le stockage du navigateur est bloqué', () => {
  const blockedStorage = {
    getItem() {
      throw new DOMException('Accès refusé', 'SecurityError');
    },
    setItem() {
      throw new DOMException('Accès refusé', 'SecurityError');
    },
    removeItem() {
      throw new DOMException('Accès refusé', 'SecurityError');
    }
  };
  const store = createSessionStore(blockedStorage, () => 1_000);

  assert.equal(store.save(validState), false);
  assert.equal(store.load(), null);
  assert.doesNotThrow(() => store.clear());
});
