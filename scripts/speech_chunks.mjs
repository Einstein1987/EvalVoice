// Découpage du texte pour la synthèse vocale.
//
// Sur Android (et ChromeOS), l'implémentation de la Web Speech API tronque ou
// échoue silencieusement au-delà d'environ 200 caractères par énoncé. On
// découpe donc les questions longues — typiquement les tâches complexes de
// niveau 3 — en morceaux courts, de préférence sur une frontière de phrase,
// sinon sur une frontière de mot, et en dernier recours sur la limite dure.

export const SPEECH_CHUNK_LIMIT = 200;

function splitLongWord(word, limit) {
  const pieces = [];
  for (let index = 0; index < word.length; index += limit) {
    pieces.push(word.slice(index, index + limit));
  }
  return pieces;
}

function splitSentenceByWords(sentence, limit) {
  const chunks = [];
  let current = '';

  const flush = () => {
    if (current) chunks.push(current);
    current = '';
  };

  for (const word of sentence.split(' ')) {
    if (!word) continue;

    if (word.length > limit) {
      flush();
      chunks.push(...splitLongWord(word, limit));
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > limit) {
      flush();
      current = word;
    } else {
      current = candidate;
    }
  }

  flush();
  return chunks;
}

/**
 * Découpe un texte en énoncés de synthèse d'au plus `limit` caractères.
 *
 * @param {string} text
 * @param {number} [limit]
 * @returns {string[]}
 */
export function splitIntoSpeechChunks(text, limit = SPEECH_CHUNK_LIMIT) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : SPEECH_CHUNK_LIMIT;
  const normalized = String(text ?? '')
    .replace(/\s+/gu, ' ')
    .trim();

  if (!normalized) return [];
  if (normalized.length <= safeLimit) return [normalized];

  // On conserve la ponctuation finale de chaque phrase pour garder une
  // prosodie correcte.
  const sentences = normalized.match(/[^.!?;:…]+(?:[.!?;:…]+|$)/gu) ?? [normalized];
  const chunks = [];
  let current = '';

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = '';
  };

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    if (sentence.length > safeLimit) {
      flush();
      chunks.push(...splitSentenceByWords(sentence, safeLimit));
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > safeLimit) {
      flush();
      current = sentence;
    } else {
      current = candidate;
    }
  }

  flush();
  return chunks;
}
