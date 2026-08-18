const MAX_FILE_SIZE = 20 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_REQUEST_BODY_SIZE = 2_048;
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9_-]{20,128}$/u;
const MAX_FILE_SIZE_LABEL = '20 Mo';

class PublicError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PublicError';
    this.status = status;
  }
}

function safeOrigin(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function allowedOrigins(environment = process.env) {
  const configured = String(environment.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const netlifyUrls = [
    environment.URL,
    environment.DEPLOY_URL,
    environment.DEPLOY_PRIME_URL
  ].filter(Boolean);

  return new Set(
    [...configured, ...netlifyUrls]
      .map(safeOrigin)
      .filter(Boolean)
  );
}

export function isOriginAllowed(origin, environment = process.env) {
  if (!origin) return true;
  const normalized = safeOrigin(origin);
  if (!normalized) return false;
  if (allowedOrigins(environment).has(normalized)) return true;

  const isDevelopment =
    environment.CONTEXT === 'dev' || environment.NETLIFY_DEV === 'true';
  if (!isDevelopment) return false;

  const url = new URL(normalized);
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

export function validateDocumentId(value) {
  return typeof value === 'string' && DOCUMENT_ID_PATTERN.test(value);
}

export function googlePdfUrl(documentId) {
  if (!validateDocumentId(documentId)) {
    throw new PublicError('Identifiant Google Docs invalide.', 400);
  }
  return `https://docs.google.com/document/d/${documentId}/export?format=pdf`;
}

function corsHeaders(origin, environment) {
  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff'
  };
  if (origin && isOriginAllowed(origin, environment)) {
    headers['Access-Control-Allow-Origin'] = safeOrigin(origin);
  }
  return headers;
}

function jsonResponse(payload, status, headers = {}) {
  return Response.json(payload, {
    status,
    headers: {
      ...headers,
      'Cache-Control': 'no-store'
    }
  });
}

function declaredContentLength(response) {
  const value = response.headers.get('content-length');
  if (!value || !/^\d+$/u.test(value)) return null;
  const size = Number(value);
  return Number.isSafeInteger(size) ? size : null;
}

/**
 * Transmet le corps Google Docs sans le mettre entièrement en mémoire.
 * Le minuteur reste actif jusqu'à la fin de la lecture et le flux est coupé
 * dès que la limite de sécurité est franchie.
 */
function createGuardedPdfStream(
  upstreamBody,
  {
    maxFileSize,
    abortController,
    timeout
  }
) {
  const reader = upstreamBody.getReader();
  let totalLength = 0;
  let finished = false;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
  };

  return new ReadableStream({
    async pull(streamController) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          cleanup();
          if (totalLength === 0) {
            streamController.error(
              new PublicError('Google Docs a renvoyé un document vide.', 502)
            );
            return;
          }
          streamController.close();
          return;
        }
        if (!value) return;

        totalLength += value.byteLength;
        if (totalLength > maxFileSize) {
          cleanup();
          abortController.abort();
          await reader.cancel();
          streamController.error(
            new PublicError(
              `Le PDF dépasse la taille maximale de ${MAX_FILE_SIZE_LABEL}.`,
              413
            )
          );
          return;
        }
        streamController.enqueue(value);
      } catch (error) {
        cleanup();
        streamController.error(
          error.name === 'AbortError'
            ? new PublicError('Le téléchargement a dépassé 25 secondes.', 504)
            : error
        );
      }
    },
    async cancel(reason) {
      cleanup();
      abortController.abort();
      await reader.cancel(reason);
    }
  });
}

export async function downloadGooglePdf(
  documentId,
  fetchImplementation = globalThis.fetch,
  {
    maxFileSize = MAX_FILE_SIZE,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let streamCreated = false;

  try {
    const response = await fetchImplementation(googlePdfUrl(documentId), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'Accept': 'application/pdf',
        'User-Agent': 'EvalVoice/2.0'
      }
    });

    if (!response.ok) {
      throw new PublicError(
        response.status === 404
          ? 'Document introuvable ou non partagé.'
          : 'Google Docs n’a pas pu exporter ce document.',
        response.status === 404 ? 404 : 502
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLocaleLowerCase('en-US').includes('application/pdf')) {
      throw new PublicError(
        'Le document n’est pas accessible en PDF. Vérifiez ses paramètres de partage.',
        422
      );
    }

    const declaredSize = declaredContentLength(response);
    if (declaredSize !== null && declaredSize > maxFileSize) {
      throw new PublicError(
        `Le PDF dépasse la taille maximale de ${MAX_FILE_SIZE_LABEL}.`,
        413
      );
    }
    if (!response.body) {
      throw new PublicError('Google Docs a renvoyé un document vide.', 502);
    }

    const body = createGuardedPdfStream(response.body, {
      maxFileSize,
      abortController: controller,
      timeout
    });
    streamCreated = true;
    return { body, declaredSize };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new PublicError('Le téléchargement a dépassé 25 secondes.', 504);
    }
    throw error;
  } finally {
    // Une fois le flux rendu à l'appelant, son cycle de vie gère le minuteur.
    if (!streamCreated) clearTimeout(timeout);
  }
}

export default async function handler(request) {
  const environment = process.env;
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin, environment);

  if (!isOriginAllowed(origin, environment)) {
    return jsonResponse({ error: 'Origine non autorisée.' }, 403, headers);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405, {
      ...headers,
      'Allow': 'POST, OPTIONS'
    });
  }

  const requestSize = Number(request.headers.get('content-length'));
  if (Number.isFinite(requestSize) && requestSize > MAX_REQUEST_BODY_SIZE) {
    return jsonResponse({ error: 'Requête trop volumineuse.' }, 413, headers);
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_SIZE) {
      throw new PublicError('Requête trop volumineuse.', 413);
    }
    const body = JSON.parse(rawBody);
    if (!validateDocumentId(body?.documentId)) {
      throw new PublicError('Identifiant Google Docs invalide.', 400);
    }

    const pdf = await downloadGooglePdf(body.documentId);
    return new Response(pdf.body, {
      status: 200,
      headers: {
        ...headers,
        'Cache-Control': 'no-store, private',
        'Content-Disposition': 'inline; filename="evaluation.pdf"',
        'Content-Type': 'application/pdf'
      }
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse({ error: 'Corps JSON invalide.' }, 400, headers);
    }
    if (error instanceof PublicError) {
      return jsonResponse({ error: error.message }, error.status, headers);
    }

    console.error('[fetch-doc] Échec du téléchargement', {
      name: error?.name,
      message: error?.message
    });
    return jsonResponse(
      { error: 'Le document ne peut pas être téléchargé pour le moment.' },
      500,
      headers
    );
  }
}

export const config = {
  path: '/api/fetch-doc',
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip']
  }
};

export const fetchDocConfig = Object.freeze({
  maxFileSize: MAX_FILE_SIZE,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  maxRequestBodySize: MAX_REQUEST_BODY_SIZE
});
