import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import {
  extractPdfDocument,
  pdfExtractionInternals
} from '../scripts/pdf_extractor.mjs';
import { detectQuestions } from '../scripts/question_parser.mjs';

const { fontLooksBold, joinItems, pageItemsToLines } = pdfExtractionInternals;

test('détecte un nom de police en gras', () => {
  assert.equal(
    fontLooksBold(
      { fontName: 'F1' },
      { F1: { fontFamily: 'Arial Bold' } }
    ),
    true
  );
  assert.equal(
    fontLooksBold(
      { fontName: 'F2' },
      { F2: { fontFamily: 'Arial Regular' } }
    ),
    false
  );
  assert.equal(
    fontLooksBold(
      { fontName: 'g_d0_f2' },
      { g_d0_f2: { fontFamily: 'sans-serif' } },
      { g_d0_f2: { name: 'Helvetica-Bold', bold: true } }
    ),
    true
  );
});

test('reconstitue une ligne dans l’ordre horizontal sans espace avant la ponctuation', () => {
  const line = joinItems([
    { text: 'monde', x: 45, width: 24, height: 10 },
    { text: 'Bonjour', x: 10, width: 31, height: 10 },
    { text: '!', x: 70, width: 3, height: 10 }
  ]);

  assert.equal(line, 'Bonjour monde!');
});

test('conserve le signal de gras au début de la ligne', () => {
  const lines = pageItemsToLines({
    styles: {
      Bold: { fontFamily: 'Liberation Sans Bold' },
      Regular: { fontFamily: 'Liberation Sans' }
    },
    items: [
      {
        str: 'Analyser',
        transform: [10, 0, 0, 10, 10, 700],
        width: 40,
        height: 10,
        fontName: 'Bold'
      },
      {
        str: 'les résultats.',
        transform: [10, 0, 0, 10, 55, 700],
        width: 62,
        height: 10,
        fontName: 'Regular'
      }
    ]
  }, 1);

  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'Analyser les résultats.');
  assert.equal(lines[0].isBoldStart, true);
});

test('reconnaît de bout en bout le verbe en gras dans un vrai PDF', async () => {
  const document = new jsPDF();
  document.setFont('helvetica', 'bold');
  document.text('Évaluation niveau 3', 15, 18);
  document.text('Analyser', 15, 38);
  document.setFont('helvetica', 'normal');
  document.text(
    'les documents et proposer une réponse argumentée pour la commune.',
    36,
    38
  );
  document.setFont('helvetica', 'bold');
  document.text('Critères d’évaluation', 15, 65);

  const extracted = await extractPdfDocument(
    new Uint8Array(document.output('arraybuffer')),
    pdfjsLib
  );
  const result = detectQuestions(extracted.lines);

  assert.equal(result.strategy, 'bold-bloom-verb');
  assert.equal(result.bloomVerb, 'Analyser');
  assert.equal(result.questions.length, 1);
  assert.match(result.questions[0], /^Analyser les documents/u);
  assert.doesNotMatch(result.questions[0], /Critères/u);
});
