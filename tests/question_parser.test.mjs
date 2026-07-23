import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectQuestions,
  getLeadingBloomVerb,
  getBloomVerbNearStart
} from '../scripts/question_parser.mjs';

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

test('arrête la dernière question avant un barème renseigné sur la même ligne', () => {
  const result = detectQuestions([
    { text: '1) Identifier la grandeur représentée sur le graphique.' },
    { text: '2) Calculer sa valeur puis justifier la méthode choisie.' },
    { text: 'Barème : 5 points répartis entre le calcul et la justification.' },
    { text: 'Présentation : 1 point' }
  ]);

  assert.equal(result.requiresReview, false);
  assert.equal(result.questions.length, 2);
  assert.doesNotMatch(result.questions[1], /Barème/u);
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

test('reconnaît les verbes de physique-chimie ajoutés', () => {
  assert.equal(getLeadingBloomVerb('Schématiser le circuit électrique.'), 'Schématiser');
  assert.equal(getLeadingBloomVerb('Tracer la courbe d’étalonnage.'), 'Tracer');
  assert.equal(getLeadingBloomVerb('Compléter le tableau de mesures.'), 'Compléter');
  assert.equal(getLeadingBloomVerb('Conclure quant à la nature du mélange.'), 'Conclure');
  assert.equal(getLeadingBloomVerb('Extraire les informations utiles du document.'), 'Extraire');
});

test('reconnaît un verbe de Bloom après un connecteur ou une virgule', () => {
  assert.equal(getBloomVerbNearStart('En déduire l’expression de la vitesse.'), 'déduire');
  assert.equal(
    getBloomVerbNearStart('À partir du graphique, déterminer la constante de temps.'),
    'déterminer'
  );
  assert.equal(getBloomVerbNearStart('Puis calculer la valeur moyenne.'), 'calculer');
});

test('reconnaît les amorces à plusieurs virgules et avec deux-points', () => {
  assert.equal(
    getBloomVerbNearStart(
      'À partir des documents 1, 2 et 3, analyser la solution proposée.'
    ),
    'analyser'
  );
  assert.equal(
    getBloomVerbNearStart(
      'À partir du graphique : déterminer la constante de temps.'
    ),
    'déterminer'
  );
});

test('auto-accepte une amorce non initiale seulement si le verbe est en gras', () => {
  const boldResult = detectQuestions([
    {
      text: 'À partir des documents 1, 2 et 3, analyser la solution proposée et justifier la réponse.',
      boldWords: ['analyser']
    }
  ]);
  const plainResult = detectQuestions([
    {
      text: 'À partir des documents 1, 2 et 3, analyser la solution proposée et justifier la réponse.'
    }
  ]);

  assert.equal(boldResult.strategy, 'bold-bloom-verb');
  assert.equal(boldResult.requiresReview, false);
  assert.equal(plainResult.strategy, 'ambiguous-bloom');
  assert.equal(plainResult.requiresReview, true);
});

test('reconnaît un verbe non initial entouré de marqueurs de gras', () => {
  const result = detectQuestions(
    'Sujet\nÀ partir du graphique : **déterminer** la constante de temps du système.'
  );

  assert.equal(result.strategy, 'bold-bloom-verb');
  assert.equal(result.requiresReview, false);
  assert.equal(result.bloomVerb, 'déterminer');
});

test('envoie une phrase descriptive avec un verbe après virgule en validation', () => {
  const result = detectQuestions([
    {
      text: 'Dans cette fiche, observer signifie regarder attentivement sans intervenir.'
    }
  ]);

  assert.equal(result.strategy, 'ambiguous-bloom');
  assert.equal(result.requiresReview, true);
  assert.equal(result.questions.length, 0);
});

test('n’assimile pas un verbe interne de consigne à une amorce', () => {
  assert.equal(
    getBloomVerbNearStart('Votre réponse doit mobiliser les données et justifier les choix.'),
    null
  );
});

test('reconnaît une tâche complexe amorcée par « En déduire » en gras', () => {
  const result = detectQuestions([
    { text: 'Exercice' },
    { text: 'En déduire la concentration de la solution inconnue.', isBoldStart: true }
  ]);

  assert.equal(result.requiresReview, false);
  assert.equal(result.strategy, 'bold-bloom-verb');
  assert.equal(result.bloomVerb, 'déduire');
});
