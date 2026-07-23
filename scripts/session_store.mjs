const STORAGE_KEY = 'evalvoice.session';
const SCHEMA_VERSION = 2;
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function cleanString(value, maxLength = 50_000) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function validatePayload(candidate) {
  if (!candidate || candidate.version !== SCHEMA_VERSION) return null;
  if (!Number.isFinite(candidate.savedAt)) return null;
  if (!candidate.state || !Array.isArray(candidate.state.questions)) return null;

  const questions = candidate.state.questions
    .map((question) => cleanString(question))
    .filter(Boolean)
    .slice(0, 200);
  if (questions.length === 0) return null;

  const responses = questions.map((_, index) =>
    cleanString(candidate.state.responses?.[index])
  );

  return {
    savedAt: candidate.savedAt,
    state: {
      evaluationTitle: cleanString(candidate.state.evaluationTitle, 200) || 'Évaluation',
      questions,
      responses,
      currentQuestion: Math.max(
        0,
        Math.min(
          questions.length - 1,
          Number.isInteger(candidate.state.currentQuestion)
            ? candidate.state.currentQuestion
            : 0
        )
      ),
      studentName: cleanString(candidate.state.studentName, 300),
      speechRate: Math.max(
        0.5,
        Math.min(2, Number(candidate.state.speechRate) || 1)
      ),
      hasUnsavedWork: Boolean(candidate.state.hasUnsavedWork)
    }
  };
}

export function createSessionStore(
  storage,
  now = () => Date.now()
) {
  let activeStorage = storage;
  if (!activeStorage) {
    try {
      activeStorage = globalThis.sessionStorage;
    } catch {
      activeStorage = null;
    }
  }

  return {
    save(state) {
      const payload = validatePayload({
        version: SCHEMA_VERSION,
        savedAt: now(),
        state
      });
      if (!payload) return false;

      try {
        activeStorage?.setItem(STORAGE_KEY, JSON.stringify({
          version: SCHEMA_VERSION,
          ...payload
        }));
        return Boolean(activeStorage);
      } catch {
        return false;
      }
    },

    load() {
      try {
        const raw = activeStorage?.getItem(STORAGE_KEY);
        if (!raw) return null;

        const payload = validatePayload(JSON.parse(raw));
        if (!payload || now() - payload.savedAt > MAX_AGE_MS) {
          activeStorage?.removeItem(STORAGE_KEY);
          return null;
        }
        return payload.state;
      } catch {
        try {
          activeStorage?.removeItem(STORAGE_KEY);
        } catch {
          // Le stockage peut être entièrement bloqué par le navigateur.
        }
        return null;
      }
    },

    clear() {
      try {
        activeStorage?.removeItem(STORAGE_KEY);
      } catch {
        // La session reste simplement indisponible.
      }
    }
  };
}

export const sessionStoreConfig = Object.freeze({
  storageKey: STORAGE_KEY,
  schemaVersion: SCHEMA_VERSION,
  maxAgeMs: MAX_AGE_MS
});
