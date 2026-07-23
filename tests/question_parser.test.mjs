import test from 'node:test';
import assert from 'node:assert/strict';

import { detectQuestions, getLeadingBloomVerb } from '../scripts/question_parser.mjs';

test('reconnaît une évaluation de niveau 2 numérotée 1), 2), 3)', () => {
  const result = detectQuestions([
    { text: 'Évaluation de sciences' },
    { text: '1) Identifier les deux forces représentées sur le schéma.' },
    { text: 'Préciser leur direction et leur sens.' },
    { text: '2) Expliquer pourquoi le solide reste immobile.' },
    { text: 'Appuyer la réponse sur le principe d’inertie.' },
    { text: '3) Calculer la valeur de la force exercée par le support.' },
    { text: 'Barème' },
    { text: '1) 2 points' },
    { text: '2) 3 points' },
    { text: '3) 2 points' }
  ]);

  assert.equal(result.requiresReview, false);
  assert.equal(result.strategy, 'numbered-sequence');
  assert.equal(result.questions.length, 3);
  assert.match(result.questions[0], /^Identifier/u);
  assert.match(result.questions[0], /direction et leur sens/u);
  assert.doesNotMatch(result.questions[2], /Barème/u);
});

test('reconnaît une tâche complexe non numérotée grâce au verbe de Bloom en gras', () => {
  const result = detectQuestions([
    { text: 'Niveau 3 — Mobilité durable' },
    { text: 'Tâche complexe' },
    {
      text: 'Analyser les documents puis proposer une solution argumentée pour la commune.',
      isBoldStart: true
    },
    { text: 'Votre réponse doit mobiliser les données chiffrées et justifier les choix.' },
    { text: 'Critères d’évaluation' },
    { text: 'Pertinence de la démarche' }
  ]);

  assert.equal(result.requiresReview, false);
  assert.equal(result.strategy, 'bold-bloom-verb');
  assert.equal(result.bloomVerb, 'Analyser');
  assert.deepEqual(result.questions, [
    'Analyser les documents puis proposer une solution argumentée pour la commune.\n' +
      'Votre réponse doit mobiliser les données chiffrées et justifier les choix.'
  ]);
});

test('reconnaît aussi le gras représenté par des marqueurs Markdown', () => {
  const result = detectQuestions(
    'Sujet\n**Évaluer** la fiabilité des deux sources et rédiger une conclusion justifiée.'
  );

  assert.equal(result.strategy, 'bold-bloom-verb');
  assert.equal(result.questions.length, 1);
});

test('accepte une seule question numérotée explicite', () => {
  const result = detectQuestions([
    { text: 'Question 1 : Expliquer comment cette expérience valide l’hypothèse proposée.' }
  ]);

  assert.equal(result.requiresReview, false);
  assert.equal(result.strategy, 'single-numbered');
  assert.deepEqual(result.questions, [
    'Expliquer comment cette expérience valide l’hypothèse proposée.'
  ]);
});

test('ne confond pas une liste de barème avec des questions', () => {
  const result = detectQuestions([
    { text: 'Barème' },
    { text: '1) 2 points' },
    { text: '2) 3 points' },
    { text: '3) 1 point' }
  ]);

  assert.equal(result.requiresReview, true);
  assert.equal(result.questions.length, 0);
});

test('demande une validation quand plusieurs verbes de Bloom en gras sont ambigus', () => {
  const result = detectQuestions([
    { text: 'Analyser les résultats de la première expérience.', isBoldStart: true },
    { text: 'Comparer les résultats avec ceux de la seconde expérience.', isBoldStart: true }
  ]);

  assert.equal(result.requiresReview, true);
  assert.equal(result.strategy, 'ambiguous-bloom');
  assert.match(result.suggestion, /---/u);
});

test('tolère un PDF qui ne permet pas d’identifier le gras si la tâche est unique', () => {
  const result = detectQuestions([
    { text: 'Consigne :' },
    {
      text: 'Justifier le choix du matériau en utilisant toutes les propriétés données dans le tableau.'
    }
  ]);

  assert.equal(result.requiresReview, false);
  assert.equal(result.strategy, 'bloom-verb');
  assert.equal(result.confidence, 'medium');
});

test('normalise les accents pour les verbes de Bloom', () => {
  assert.equal(getLeadingBloomVerb('Élaborer un protocole expérimental.'), 'Élaborer');
  assert.equal(getLeadingBloomVerb('Récitez ce texte.'), null);
});
