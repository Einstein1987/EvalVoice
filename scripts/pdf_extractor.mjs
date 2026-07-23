const BOLD_FONT_PATTERN = /\b(?:bold|black|heavy|semibold|demi)\b/i;

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function fontLooksBold(item, styles, fontObjects = {}) {
  const style = styles?.[item.fontName] ?? {};
  const font = fontObjects?.[item.fontName] ?? {};
  const weight = Number(font.weight ?? font.cssFontInfo?.fontWeight);
  return (
    font.bold === true ||
    font.black === true ||
    (Number.isFinite(weight) && weight >= 600) ||
    BOLD_FONT_PATTERN.test(
      [
        item.fontName,
        style.fontFamily,
        font.name,
        font.loadedName,
        font.fallbackName,
        font.cssFontInfo?.fontFamily
      ].filter(Boolean).join(' ')
    )
  );
}

function joinItems(items) {
  const ordered = [...items].sort((a, b) => a.x - b.x);
  let text = '';
  let previousEnd = null;
  let previousFontName = null;
  let previousEndedWithSpace = false;
  let pendingSpace = false;

  for (const item of ordered) {
    const chunk = normalizeText(item.text);
    if (!chunk) {
      pendingSpace ||= item.isWhitespace;
      continue;
    }

    const estimatedFontSize = Math.max(item.height || 0, 8);
    const gap = previousEnd === null ? 0 : item.x - previousEnd;
    const fontChanged =
      previousFontName !== null &&
      item.fontName !== undefined &&
      item.fontName !== previousFontName;
    const lettersMeet = /\p{L}$/u.test(text) && /^\p{L}/u.test(chunk);
    const needsSpace =
      text.length > 0 &&
      !/[\s([{«"'’/-]$/u.test(text) &&
      !/^[,.;:!?%)\]}»'’/-]/u.test(chunk) &&
      (
        pendingSpace ||
        item.startsWithSpace ||
        previousEndedWithSpace ||
        gap > estimatedFontSize * 0.08 ||
        (fontChanged && lettersMeet)
      );

    text += `${needsSpace ? ' ' : ''}${chunk}`;
    previousEnd = item.x + Math.max(item.width || 0, chunk.length * estimatedFontSize * 0.35);
    previousFontName = item.fontName;
    previousEndedWithSpace = item.endsWithSpace;
    pendingSpace = false;
  }

  return normalizeText(text)
    .replace(/\s+([,.;:!?])/gu, '$1')
    .replace(/([«([{])\s+/gu, '$1');
}

function pageItemsToLines(textContent, pageNumber, fontObjects = {}) {
  const rows = [];

  for (const item of textContent.items ?? []) {
    if (!('str' in item)) continue;
    const rawText = String(item.str ?? '');
    const text = normalizeText(rawText);
    if (!text && !/\s/u.test(rawText)) continue;

    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = Number(transform[4] ?? 0);
    const y = Number(transform[5] ?? 0);
    const height = Math.abs(Number(item.height ?? transform[3] ?? 10));
    const tolerance = Math.max(2, Math.min(4, height * 0.35));
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= tolerance);

    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }

    row.items.push({
      text,
      x,
      width: Number(item.width ?? 0),
      height,
      fontName: item.fontName,
      startsWithSpace: /^\s/u.test(rawText),
      endsWithSpace: /\s$/u.test(rawText),
      isWhitespace: !text && /\s/u.test(rawText),
      isBold: fontLooksBold(item, textContent.styles, fontObjects)
    });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const orderedItems = [...row.items].sort((a, b) => a.x - b.x);
      const firstTextItem = orderedItems.find((item) => item.text);
      const boldText = joinItems(orderedItems.filter((item) => item.isBold));
      return {
        text: joinItems(orderedItems),
        isBoldStart: Boolean(firstTextItem?.isBold),
        boldWords:
          boldText.match(/[\p{L}À-ÿŒœ][\p{L}À-ÿŒœ'’-]*/gu) ?? [],
        pageNumber
      };
    })
    .filter((line) => line.text);
}

function titleFromMetadata(metadata, lines) {
  const metadataTitle = normalizeText(metadata?.info?.Title);
  if (metadataTitle && !/^untitled$/i.test(metadataTitle)) return metadataTitle;

  const firstCandidate = lines.find((line) => {
    const text = line.text;
    return text.length >= 4 && text.length <= 120 && !/^\d+\s*[).:-]/u.test(text);
  });
  return firstCandidate?.text ?? 'Évaluation';
}

export async function extractPdfDocument(data, pdfjsLib) {
  if (!pdfjsLib?.getDocument) {
    throw new Error('Le moteur PDF n’est pas disponible.');
  }

  const loadingTask = pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true
  });
  const pdf = await loadingTask.promise;

  try {
    const lines = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent({
        includeMarkedContent: false,
        disableNormalization: false
      });

      const fontObjects = {};
      try {
        // getOperatorList résout les objets de police. PDF.js n'expose pas le
        // poids dans TextStyle, mais FontFaceObject fournit notamment `bold`.
        await page.getOperatorList();
        const fontNames = new Set(
          textContent.items
            .filter((item) => 'fontName' in item)
            .map((item) => item.fontName)
        );
        for (const fontName of fontNames) {
          try {
            fontObjects[fontName] = page.commonObjs.get(fontName);
          } catch {
            // Certains PDF ne rendent pas l'objet de police accessible.
          }
        }
      } catch {
        // Le parseur conserve le fallback sur le nom de police.
      }

      lines.push(...pageItemsToLines(textContent, pageNumber, fontObjects));
      if (pageNumber < pdf.numPages) {
        lines.push({ text: '', isBoldStart: false, pageNumber });
      }
      page.cleanup();
    }

    let metadata = null;
    try {
      metadata = await pdf.getMetadata();
    } catch {
      // Les métadonnées ne sont pas indispensables à l'extraction.
    }

    const text = lines.map((line) => line.text).join('\n').trim();
    if (!text) {
      throw new Error(
        'Aucun texte n’a pu être extrait. Le PDF est peut-être une image numérisée sans OCR.'
      );
    }

    return {
      lines,
      text,
      pageCount: pdf.numPages,
      title: titleFromMetadata(metadata, lines)
    };
  } finally {
    await loadingTask.destroy();
  }
}

export const pdfExtractionInternals = Object.freeze({
  fontLooksBold,
  joinItems,
  pageItemsToLines
});
