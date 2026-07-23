const BLOOM_VERBS = new Set([
  'analyser', 'analysez', 'appliquer', 'appliquez', 'argumenter', 'argumentez',
  'associer', 'associez', 'calculer', 'calculez', 'categoriser', 'categorisez',
  'citer', 'citez', 'classer', 'classez', 'comparer', 'comparez', 'concevoir',
  'concevez', 'construire', 'construisez', 'creer', 'creez', 'critiquer',
  'critiquez', 'decomposer', 'decomposez', 'defendre', 'defendez', 'definir',
  'definissez', 'decrire', 'decrivez', 'demontrer', 'demontrez', 'determiner',
  'determinez', 'differencier', 'differenciez', 'distinguer', 'distinguez',
  'elaborer', 'elaborez', 'employer', 'employez', 'enumerer', 'enumerez',
  'evaluer', 'evaluez', 'examiner', 'examinez', 'executer', 'executez',
  'expliquer', 'expliquez', 'formuler', 'formulez', 'identifier', 'identifiez',
  'illustrer', 'illustrez', 'imaginer', 'imaginez', 'indiquer', 'indiquez',
  'interpreter', 'interpretez', 'justifier', 'justifiez', 'lister', 'listez',
  'mettre', 'mettez', 'nommer', 'nommez', 'organiser', 'organisez', 'planifier',
  'planifiez', 'produire', 'produisez', 'proposer', 'proposez', 'realiser',
  'realisez', 'rediger', 'redigez', 'reformuler', 'reformulez', 'relier',
  'reliez', 'relever', 'relevez', 'reperer', 'reperez', 'resoudre', 'resolvez',
  'resumer', 'resumez', 'synthetiser', 'synthetisez', 'utiliser', 'utilisez',
  'valider', 'validez', 'verifier', 'verifiez',
  // Verbes complémentaires fréquents en physique-chimie
  'completer', 'completez', 'conclure', 'concluez', 'dater', 'datez',
  'deduire', 'deduisez', 'extraire', 'extrayez', 'observer', 'observez',
  'ordonner', 'ordonnez', 'prevoir', 'prevoyez', 'schematiser', 'schematisez',
  'tracer', 'tracez'
]);

const NUMBERED_PATTERN =
  /^\s*(?:(question|q)\s*)?(\d{1,3})\s*(?:[)\].:–—-])\s*(.*)$/iu;

const SECTION_BOUNDARY_PATTERN =
  /^\s*(?:bar[eè]me|corrig[eé]|correction|crit[eè]res?(?:\s+d['’][eé]valuation)?|grille\s+d['’][eé]valuation|annexes?|documents?\s+(?:ressources?|annexes?)|comp[eé]tences?\s+[eé]valu[eé]es?)\s*(?::\s*.*)?$/iu;

const NEGATIVE_CONTEXT_PATTERN =
  /\b(?:bar[eè]me|notation|points?|crit[eè]res?|corrig[eé]|correction)\b/iu;

// Les grilles d'évaluation placent souvent un code très court (COM, RCO/,
// APP...) juste après la formulation d'une compétence. Ce signal permet de ne
// pas confondre « Rédiger un texte... » avec une consigne destinée à l'élève.
const COMPETENCY_CODE_PATTERN =
  /^[A-ZÀ-ÖØ-Þ]{2,6}(?:\s*[/+.-]\s*[A-ZÀ-ÖØ-Þ0-9]{0,6})?$/u;

const INTERROGATIVE_PATTERN =
  /^(?:a\s+partir|comment|dans\s+quelle\s+mesure|de\s+quelle|explique|indique|pourquoi|qu['’]est-ce|quel(?:le)?s?\b|qui\b|relevez|selon\b)/iu;

function fold(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR');
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function stripEmphasis(value) {
  return cleanLine(value)
    .replace(/^(?:\*\*|__|<strong>)/iu, '')
    .replace(/(?:\*\*|__|<\/strong>)/iu, '');
}

function wordsOf(value) {
  return String(value ?? '').match(/[\p{L}À-ÿŒœ][\p{L}À-ÿŒœ'’-]*/gu) ?? [];
}

function emphasizedWords(value) {
  const words = [];
  const pattern = /(?:\*\*|__|<strong>)(.*?)(?:\*\*|__|<\/strong>)/giu;
  for (const match of String(value ?? '').matchAll(pattern)) {
    words.push(...wordsOf(match[1]));
  }
  return words;
}

function normalizeLines(source) {
  if (Array.isArray(source)) {
    return source.flatMap((line, sourceIndex) => {
      const text = typeof line === 'string' ? line : line?.text;
      return String(text ?? '').split(/\r?\n/).map((part) => {
        const markedWords = emphasizedWords(part);
        const suppliedWords =
          typeof line === 'object'
            ? Array.isArray(line.boldWords)
              ? line.boldWords
              : wordsOf(line.boldText)
            : [];
        const hasSuppliedMetadata = Boolean(
          typeof line === 'object' &&
          (
            Object.hasOwn(line, 'boldWords') ||
            Object.hasOwn(line, 'boldText')
          )
        );

        return {
          text: cleanLine(part),
          isBoldStart: Boolean(
            typeof line === 'object' && (line.isBoldStart || line.isBold)
          ) || /^\s*(?:\*\*|__|<strong>)/iu.test(part),
          boldWords: [...suppliedWords, ...markedWords],
          hasBoldWordMetadata:
            hasSuppliedMetadata || markedWords.length > 0,
          pageNumber: typeof line === 'object' ? line.pageNumber : undefined,
          sourceIndex
        };
      });
    });
  }

  return String(source ?? '').split(/\r?\n/).map((text, sourceIndex) => {
    const markedWords = emphasizedWords(text);
    return {
      text: cleanLine(text),
      isBoldStart: /^\s*(?:\*\*|__|<strong>)/iu.test(text),
      boldWords: markedWords,
      hasBoldWordMetadata: markedWords.length > 0,
      sourceIndex
    };
  });
}

export function getLeadingBloomVerb(value) {
  const withoutNumber = stripEmphasis(value).replace(NUMBERED_PATTERN, '$3');
  const match = withoutNumber.match(/^[«"'([{]*([\p{L}À-ÿŒœ'-]+)/u);
  if (!match) return null;

  const normalized = fold(match[1].replace(/[’']/g, ''));
  return BLOOM_VERBS.has(normalized) ? match[1] : null;
}

// Connecteurs pouvant précéder le verbe en tête de consigne (« En déduire… »,
// « Puis calculer… »). On s'arrête au premier mot non-connecteur : on ne
// transforme donc pas chaque verbe interne d'une consigne en nouvelle question.
const LEADING_CONNECTORS = new Set([
  'en', 'puis', 'ensuite', 'enfin', 'alors', 'donc', 'ainsi', 'apres'
]);

function firstBloomAfterConnectors(words) {
  for (const word of words) {
    const normalized = fold(word.replace(/[’']/g, ''));
    if (BLOOM_VERBS.has(normalized)) return word;
    if (!LEADING_CONNECTORS.has(normalized)) return null;
  }
  return null;
}

/**
 * Détecte un verbe de Bloom en tête de proposition : en début de ligne (en
 * sautant d'éventuels connecteurs), ou juste après une ponctuation d'amorce.
 * Le type de position est conservé afin que l'appelant exige un signal de gras
 * pour les verbes non initiaux.
 */
export function getBloomMatchNearStart(value) {
  const base = stripEmphasis(value).replace(NUMBERED_PATTERN, '$3');

  const direct = getLeadingBloomVerb(base);
  if (direct) return { verb: direct, position: 'initial' };

  const afterConnectors = firstBloomAfterConnectors(wordsOf(base));
  if (afterConnectors) {
    return { verb: afterConnectors, position: 'prefixed' };
  }

  for (const punctuation of base.matchAll(/[,;:]/gu)) {
    const clause = firstBloomAfterConnectors(
      wordsOf(base.slice(punctuation.index + punctuation[0].length))
    );
    if (clause) return { verb: clause, position: 'prefixed' };
  }

  return null;
}

export function getBloomVerbNearStart(value) {
  return getBloomMatchNearStart(value)?.verb ?? null;
}

function lineHasBoldVerb(line, verb, position) {
  if (position === 'initial' && line.isBoldStart) return true;
  const normalizedVerb = fold(verb.replace(/[’']/g, ''));
  const explicitlyBold = line.boldWords.some(
    (word) => fold(word.replace(/[’']/g, '')) === normalizedVerb
  );
  if (explicitlyBold) return true;
  if (line.hasBoldWordMetadata) return false;
  return line.isBoldStart;
}

function isQuestionLike(value) {
  const text = stripEmphasis(value);
  return (
    text.length >= 12 &&
    (
      text.includes('?') ||
      Boolean(getBloomVerbNearStart(text)) ||
      INTERROGATIVE_PATTERN.test(text)
    )
  );
}

function nearbyContext(lines, index, distance = 3) {
  return lines
    .slice(Math.max(0, index - distance), index)
    .map((line) => line.text)
    .join(' ');
}

function previewFrom(lines, index, count = 3) {
  return lines
    .slice(index, index + count)
    .map((line) => line.text)
    .filter(Boolean)
    .join(' ');
}

function scoreNumberedCandidate(candidate, lines) {
  const preview = previewFrom(lines, candidate.lineIndex);
  const content = candidate.content || preview.replace(NUMBERED_PATTERN, '$3');
  let score = 0;

  if (candidate.explicitLabel) score += 4;
  if (isQuestionLike(content)) score += 4;
  if (getBloomVerbNearStart(content)) score += 2;
  if (content.length >= 25) score += 1;
  if (/\b\d+(?:[,.]\d+)?\s*(?:points?|pts?)\b/iu.test(content)) score -= 3;
  if (NEGATIVE_CONTEXT_PATTERN.test(nearbyContext(lines, candidate.lineIndex))) {
    score -= 5;
  }

  return score;
}

function findNumberedCandidates(lines) {
  const candidates = [];

  lines.forEach((line, lineIndex) => {
    const match = line.text.match(NUMBERED_PATTERN);
    if (!match) return;

    const candidate = {
      lineIndex,
      number: Number.parseInt(match[2], 10),
      explicitLabel: Boolean(match[1]),
      content: cleanLine(match[3])
    };
    candidate.score = scoreNumberedCandidate(candidate, lines);
    candidates.push(candidate);
  });

  return candidates;
}

function buildSequentialRuns(candidates) {
  const runs = [];

  for (const candidate of candidates) {
    const previousRun = runs.at(-1);
    const previousCandidate = previousRun?.at(-1);

    if (
      previousCandidate &&
      candidate.number === previousCandidate.number + 1 &&
      candidate.lineIndex - previousCandidate.lineIndex < 120
    ) {
      previousRun.push(candidate);
    } else {
      runs.push([candidate]);
    }
  }

  return runs;
}

function scoreRun(run) {
  const beginsAtOne = run[0]?.number === 1 ? 3 : 0;
  const lengthBonus = run.length >= 2 ? run.length * 4 : 0;
  return run.reduce((total, candidate) => total + candidate.score, 0) +
    beginsAtOne + lengthBonus;
}

function findBoundaryIndex(lines, startIndex, hardEnd = lines.length) {
  for (let index = startIndex; index < hardEnd; index += 1) {
    if (SECTION_BOUNDARY_PATTERN.test(lines[index].text)) return index;
  }
  return hardEnd;
}

function joinQuestionLines(lines, startIndex, endIndex, stripNumber = false) {
  const selected = lines
    .slice(startIndex, endIndex)
    .map((line) => line.text)
    .filter(Boolean);

  if (stripNumber && selected.length > 0) {
    selected[0] = selected[0].replace(NUMBERED_PATTERN, '$3').trim();
  }

  return selected
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractNumbered(lines) {
  const candidates = findNumberedCandidates(lines);
  if (candidates.length === 0) return null;

  const rankedRuns = buildSequentialRuns(candidates)
    .map((run) => ({ run, score: scoreRun(run) }))
    .sort((a, b) => b.score - a.score);
  const best = rankedRuns[0];
  if (!best) return null;

  const isStrongSingle =
    best.run.length === 1 &&
    best.run[0].score >= 5 &&
    (best.run[0].explicitLabel || isQuestionLike(best.run[0].content));
  const isStrongSequence =
    best.run.length >= 2 &&
    best.run.filter((candidate) => candidate.score >= 0).length === best.run.length &&
    best.score >= best.run.length * 4;

  if (!isStrongSingle && !isStrongSequence) return null;

  const questions = best.run.map((candidate, index) => {
    const nextCandidate = best.run[index + 1];
    const hardEnd = nextCandidate?.lineIndex ?? lines.length;
    const endIndex = findBoundaryIndex(lines, candidate.lineIndex + 1, hardEnd);
    return joinQuestionLines(lines, candidate.lineIndex, endIndex, true);
  }).filter((question) => question.length >= 10);

  if (questions.length !== best.run.length) return null;

  return {
    questions,
    strategy: best.run.length === 1 ? 'single-numbered' : 'numbered-sequence',
    confidence: best.run.length >= 2 || best.run[0].explicitLabel ? 'high' : 'medium',
    requiresReview: false,
    reason: best.run.length === 1
      ? 'Une question numérotée explicite a été reconnue.'
      : `Une séquence cohérente de ${best.run.length} questions a été reconnue.`
  };
}

function scoreBloomCandidate(candidate, lines) {
  const preview = previewFrom(lines, candidate.lineIndex, 4);
  let score = candidate.isBoldStart ? 6 : 0;
  if (preview.length >= 35) score += 2;
  if (preview.includes('?')) score += 1;
  if (/^(?:consigne|t[aâ]che)\s*:/iu.test(nearbyContext(lines, candidate.lineIndex, 2))) {
    score += 2;
  }
  if (NEGATIVE_CONTEXT_PATTERN.test(nearbyContext(lines, candidate.lineIndex))) {
    score -= 7;
  }
  return score;
}

function nextNonEmptyLine(lines, startIndex) {
  return lines.slice(startIndex).find((line) => line.text);
}

function isCompetencyGridCandidate(lines, lineIndex) {
  const nextLine = nextNonEmptyLine(lines, lineIndex + 1);
  return Boolean(nextLine && COMPETENCY_CODE_PATTERN.test(nextLine.text));
}

function hasSectionBoundaryBetween(lines, startIndex, endIndex) {
  return lines
    .slice(startIndex + 1, endIndex)
    .some((line) => SECTION_BOUNDARY_PATTERN.test(line.text));
}

function extractBoldBloomSequence(candidates, lines) {
  const boldCandidates = candidates.filter((candidate) => candidate.isBoldStart);
  if (boldCandidates.length < 2) return null;

  // Une limite de section sépare deux groupes de consignes. On retient le
  // groupe cohérent le mieux noté, puis on borne chaque question à la suivante.
  const runs = [];
  for (const candidate of boldCandidates) {
    const currentRun = runs.at(-1);
    const previous = currentRun?.at(-1);
    if (
      previous &&
      !hasSectionBoundaryBetween(lines, previous.lineIndex, candidate.lineIndex)
    ) {
      currentRun.push(candidate);
    } else {
      runs.push([candidate]);
    }
  }

  const bestRun = runs
    .filter((run) => run.length >= 2)
    .sort((left, right) => {
      const scoreDifference =
        right.reduce((total, candidate) => total + candidate.score, 0) -
        left.reduce((total, candidate) => total + candidate.score, 0);
      return scoreDifference || right.length - left.length;
    })[0];
  if (!bestRun) return null;

  const questions = bestRun.map((candidate, index) => {
    const nextCandidate = bestRun[index + 1];
    const hardEnd = nextCandidate?.lineIndex ?? lines.length;
    const endIndex = findBoundaryIndex(lines, candidate.lineIndex + 1, hardEnd);
    return joinQuestionLines(lines, candidate.lineIndex, endIndex);
  }).filter((question) => question.length >= 10);

  if (questions.length !== bestRun.length) return null;

  return {
    questions,
    strategy: 'bold-bloom-sequence',
    confidence: 'high',
    requiresReview: false,
    bloomVerbs: bestRun.map((candidate) => candidate.verb),
    reason:
      `Une séquence de ${questions.length} consignes commençant par des verbes de Bloom en gras a été reconnue.`
  };
}

function extractBloom(lines) {
  const candidates = [];

  lines.forEach((line, lineIndex) => {
    const match = getBloomMatchNearStart(line.text);
    if (!match) return;
    if (isCompetencyGridCandidate(lines, lineIndex)) return;

    const candidate = {
      lineIndex,
      verb: match.verb,
      position: match.position,
      isBoldStart: lineHasBoldVerb(line, match.verb, match.position)
    };
    candidate.score = scoreBloomCandidate(candidate, lines);
    candidates.push(candidate);
  });

  const credible = candidates
    .filter((candidate) => candidate.score >= 2)
    .sort((a, b) => a.lineIndex - b.lineIndex);
  if (credible.length === 0) return null;

  const sequence = extractBoldBloomSequence(credible, lines);
  if (sequence) return sequence;

  const ranked = [...credible].sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const runnerUp = ranked[1];
  const hasReliableBoldSignal = best.isBoldStart && (!runnerUp || best.score > runnerUp.score);
  const isUniquePlainCandidate =
    credible.length === 1 &&
    best.position === 'initial' &&
    previewFrom(lines, best.lineIndex, 4).length >= 35;

  if (!hasReliableBoldSignal && !isUniquePlainCandidate) {
    const suggestions = ranked
      .slice(0, 4)
      .map((candidate, index, selected) => {
        const nextCandidateIndex = selected
          .filter((other) => other.lineIndex > candidate.lineIndex)
          .map((other) => other.lineIndex)
          .sort((a, b) => a - b)[0];
        const hardEnd = nextCandidateIndex ?? lines.length;
        const end = findBoundaryIndex(
          lines,
          candidate.lineIndex + 1,
          hardEnd
        );
        return joinQuestionLines(lines, candidate.lineIndex, end);
      });

    return {
      questions: [],
      strategy: 'ambiguous-bloom',
      confidence: 'low',
      requiresReview: true,
      suggestion: suggestions.join('\n\n---\n\n'),
      reason: credible.length > 1
        ? 'Plusieurs consignes commençant par un verbe de Bloom ont été trouvées.'
        : 'Un verbe de Bloom non initial a été trouvé, mais son format en gras doit être confirmé.'
    };
  }

  const nextCredibleIndex = candidates
    .filter((candidate) => candidate.lineIndex > best.lineIndex)
    .map((candidate) => candidate.lineIndex)
    .sort((a, b) => a - b)[0];
  const hardEnd = nextCredibleIndex ?? lines.length;
  const endIndex = findBoundaryIndex(lines, best.lineIndex + 1, hardEnd);
  const question = joinQuestionLines(lines, best.lineIndex, endIndex);

  return {
    questions: [question],
    strategy: best.isBoldStart ? 'bold-bloom-verb' : 'bloom-verb',
    confidence: best.isBoldStart ? 'high' : 'medium',
    requiresReview: false,
    bloomVerb: best.verb,
    reason: best.isBoldStart
      ? `La tâche complexe commençant par le verbe de Bloom « ${best.verb} » en gras a été reconnue.`
      : `Une tâche complexe unique commençant par le verbe de Bloom « ${best.verb} » a été reconnue.`
  };
}

function manualSuggestion(lines) {
  const nonEmpty = lines.filter((line) => line.text);
  const likelyStart = nonEmpty.findIndex((line) =>
    /^(?:consigne|t[aâ]che(?:\s+complexe)?|sujet)\s*:/iu.test(line.text)
  );
  const selected = likelyStart >= 0 ? nonEmpty.slice(likelyStart) : nonEmpty;
  return selected.map((line) => line.text).join('\n').trim();
}

/**
 * Détecte les questions à partir de lignes extraites d'un PDF.
 *
 * Le signal « verbe de Bloom en début de ligne et en gras » est prioritaire pour
 * les tâches complexes non numérotées. Le gras reste un indice (les PDF ne
 * l'exposent pas tous de façon fiable), d'où un mode de validation manuelle en
 * cas d'ambiguïté.
 */
export function detectQuestions(source) {
  const lines = normalizeLines(source);
  const nonEmptyLines = lines.filter((line) => line.text);

  if (nonEmptyLines.length === 0) {
    return {
      questions: [],
      strategy: 'empty-document',
      confidence: 'low',
      requiresReview: true,
      suggestion: '',
      reason: 'Le PDF ne contient aucun texte exploitable.'
    };
  }

  const numbered = extractNumbered(lines);
  if (numbered) return numbered;

  const bloom = extractBloom(lines);
  if (bloom) return bloom;

  return {
    questions: [],
    strategy: 'manual-review',
    confidence: 'low',
    requiresReview: true,
    suggestion: manualSuggestion(lines),
    reason: 'Aucun pattern de question suffisamment fiable n’a été trouvé.'
  };
}

export const bloomVerbs = Object.freeze([...BLOOM_VERBS]);
