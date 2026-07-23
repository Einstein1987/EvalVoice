export const PDF_FONT_FAMILY = 'DejaVuSans';

const PDF_FONT_URLS = Object.freeze({
  normal: new URL('../vendor/fonts/DejaVuSans.ttf', import.meta.url),
  bold: new URL('../vendor/fonts/DejaVuSans-Bold.ttf', import.meta.url)
});

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const parts = [];
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    parts.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
    );
  }

  return globalThis.btoa(parts.join(''));
}

async function fetchFontFile(url, fetchImplementation) {
  const response = await fetchImplementation(url);
  if (!response.ok) {
    throw new Error(`Police PDF indisponible (${response.status}).`);
  }
  return arrayBufferToBase64(await response.arrayBuffer());
}

export async function loadPdfFontFiles(
  fetchImplementation = globalThis.fetch
) {
  if (typeof fetchImplementation !== 'function') {
    throw new Error('Le chargement des polices PDF n’est pas disponible.');
  }

  const [normal, bold] = await Promise.all([
    fetchFontFile(PDF_FONT_URLS.normal, fetchImplementation),
    fetchFontFile(PDF_FONT_URLS.bold, fetchImplementation)
  ]);
  return { normal, bold };
}

export function registerPdfFonts(doc, fontFiles) {
  if (!fontFiles?.normal || !fontFiles?.bold) {
    throw new Error('Les polices Unicode nécessaires à l’export sont absentes.');
  }

  doc.addFileToVFS('DejaVuSans.ttf', fontFiles.normal);
  doc.addFont('DejaVuSans.ttf', PDF_FONT_FAMILY, 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', fontFiles.bold);
  doc.addFont('DejaVuSans-Bold.ttf', PDF_FONT_FAMILY, 'bold');
}

export function createResponsesPdf({
  jsPDF,
  fontFiles,
  evaluationTitle = 'Évaluation',
  studentName,
  questions,
  responses,
  exportedAt = new Date()
}) {
  if (typeof jsPDF !== 'function') {
    throw new Error('Le module d’export PDF n’est pas disponible.');
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  registerPdfFonts(doc, fontFiles);

  const margin = 15;
  const pageBottom = 278;
  const lineHeight = 5.5;
  let y = 16;

  const nextPageIfNeeded = (height = lineHeight) => {
    if (y + height <= pageBottom) return;
    doc.addPage();
    y = 16;
  };

  const writeWrapped = (text, {
    size = 11,
    style = 'normal',
    indent = 0,
    spacingAfter = 3
  } = {}) => {
    doc.setFont(PDF_FONT_FAMILY, style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(text), 180 - indent);
    for (const line of lines) {
      nextPageIfNeeded(lineHeight);
      doc.text(line, margin + indent, y);
      y += lineHeight;
    }
    y += spacingAfter;
  };

  doc.setFont(PDF_FONT_FAMILY, 'bold');
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(evaluationTitle || 'Évaluation', 180);
  for (const line of titleLines) {
    nextPageIfNeeded(8);
    doc.text(line, 105, y, { align: 'center' });
    y += 8;
  }
  y += 2;
  doc.setDrawColor(11, 92, 171);
  doc.line(margin, y, 210 - margin, y);
  y += 7;

  writeWrapped(`Élève : ${studentName}`, { style: 'bold', spacingAfter: 1 });
  writeWrapped(`Exporté le ${exportedAt.toLocaleString('fr-FR')}`, {
    size: 9,
    spacingAfter: 6
  });

  questions.forEach((question, index) => {
    nextPageIfNeeded(18);
    writeWrapped(`Question ${index + 1}`, {
      size: 12,
      style: 'bold',
      spacingAfter: 1
    });
    writeWrapped(question, { style: 'bold', spacingAfter: 3 });
    writeWrapped('Réponse', { size: 10, style: 'bold', spacingAfter: 1 });
    writeWrapped(responses[index]?.trim() || 'Pas de réponse.', {
      indent: 3,
      spacingAfter: 7
    });
  });

  const totalPages = doc.internal.getNumberOfPages();
  const answered = responses.filter((response) => response?.trim()).length;
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(
      `Page ${page}/${totalPages} — ${answered}/${questions.length} réponses`,
      105,
      290,
      { align: 'center' }
    );
  }

  return doc;
}

export const pdfExportInternals = Object.freeze({
  arrayBufferToBase64
});
