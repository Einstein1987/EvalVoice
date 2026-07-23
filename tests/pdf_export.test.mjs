import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import {
  createResponsesPdf,
  loadPdfFontFiles,
  PDF_FONT_FAMILY
} from '../scripts/pdf_export.mjs';

const normalFont = await readFile(
  new URL(
    '../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',
    import.meta.url
  )
);
const boldFont = await readFile(
  new URL(
    '../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',
    import.meta.url
  )
);
const fontFiles = {
  normal: normalFont.toString('base64'),
  bold: boldFont.toString('base64')
};

test('charge les deux polices depuis les ressources locales', async () => {
  const requested = [];
  const loaded = await loadPdfFontFiles(async (url) => {
    requested.push(url.pathname.slice(url.pathname.lastIndexOf('/vendor/')));
    const bytes = url.pathname.endsWith('DejaVuSans-Bold.ttf')
      ? boldFont
      : normalFont;
    return new Response(bytes, {
      status: 200,
      headers: { 'Content-Type': 'font/ttf' }
    });
  });

  assert.deepEqual(requested, [
    '/vendor/fonts/DejaVuSans.ttf',
    '/vendor/fonts/DejaVuSans-Bold.ttf'
  ]);
  assert.deepEqual(loaded, fontFiles);
});

test('exporte sans corruption les symboles scientifiques Unicode', async () => {
  const scientificQuestion =
    'Déterminer Δt, λ et Ω puis comparer avec μ, →, ≤ et ≥.';
  const scientificResponse =
    'H₂O se déplace à 9,81 m·s⁻² dans le modèle étudié.';
  const document = createResponsesPdf({
    jsPDF,
    fontFiles,
    evaluationTitle: 'Évaluation de physique-chimie',
    studentName: 'Jérémie Dupont — 3e',
    questions: [scientificQuestion],
    responses: [scientificResponse],
    exportedAt: new Date('2026-07-23T12:00:00Z')
  });

  assert.equal(document.getFont().fontName, PDF_FONT_FAMILY);

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(document.output('arraybuffer')),
    isEvalSupported: false,
    useSystemFonts: true
  });
  const pdf = await loadingTask.promise;

  try {
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(' ');

    assert.match(text, /Jérémie Dupont — 3e/u);
    assert.match(text, /Δt, λ et Ω/u);
    assert.match(text, /μ, →, ≤ et ≥/u);
    assert.match(text, /H₂O/u);
    assert.match(text, /m·s⁻²/u);
  } finally {
    await loadingTask.destroy();
  }
});

test('pagine une réponse longue avec la police Unicode enregistrée', () => {
  const document = createResponsesPdf({
    jsPDF,
    fontFiles,
    studentName: 'Élève test',
    questions: ['Analyser les résultats.'],
    responses: ['Réponse développée avec Δ et H₂O. '.repeat(500)],
    exportedAt: new Date('2026-07-23T12:00:00Z')
  });

  assert.ok(document.internal.getNumberOfPages() > 1);
});
