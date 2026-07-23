import test from 'node:test';
import assert from 'node:assert/strict';

import handler, {
  allowedOrigins,
  downloadGooglePdf,
  googlePdfUrl,
  isOriginAllowed,
  validateDocumentId
} from '../functions/fetch-doc.mjs';

const documentId = '1AbCdEfGhIjKlMnOpQrStUvWxYz_123456';

test('valide strictement un identifiant Google Docs', () => {
  assert.equal(validateDocumentId(documentId), true);
  assert.equal(validateDocumentId('../etc/passwd'), false);
  assert.equal(validateDocumentId('trop-court'), false);
  assert.equal(
    googlePdfUrl(documentId),
    `https://docs.google.com/document/d/${documentId}/export?format=pdf`
  );
});

test('compare les origines exactement et refuse les suffixes trompeurs', () => {
  const environment = {
    ALLOWED_ORIGINS: 'https://evalvoice.example, https://classe.example',
    URL: 'https://evalvoice.netlify.app'
  };

  assert.deepEqual(
    [...allowedOrigins(environment)].sort(),
    [
      'https://classe.example',
      'https://evalvoice.example',
      'https://evalvoice.netlify.app'
    ]
  );
  assert.equal(isOriginAllowed('https://evalvoice.example', environment), true);
  assert.equal(isOriginAllowed('https://evalvoice.example.attacker.test', environment), false);
});

test('n’autorise localhost qu’en développement', () => {
  assert.equal(
    isOriginAllowed('http://localhost:8888', { CONTEXT: 'production' }),
    false
  );
  assert.equal(
    isOriginAllowed('http://localhost:8888', { CONTEXT: 'dev' }),
    true
  );
});

test('télécharge un PDF en respectant le type MIME et la taille', async () => {
  let requestedUrl = '';
  const pdf = await downloadGooglePdf(documentId, async (url, options) => {
    requestedUrl = url;
    assert.equal(options.redirect, 'follow');
    return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': '4'
      }
    });
  });

  assert.equal(requestedUrl, googlePdfUrl(documentId));
  assert.deepEqual([...pdf], [0x25, 0x50, 0x44, 0x46]);
});

test('refuse un téléchargement qui annonce une taille excessive', async () => {
  await assert.rejects(
    downloadGooglePdf(documentId, async () =>
      new Response(new Uint8Array([1]), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': '5000000'
        }
      })
    ),
    /taille maximale/u
  );
});

test('le handler refuse un identifiant invalide sans téléchargement externe', async () => {
  const response = await handler(new Request('https://evalvoice.test/api/fetch-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: 'invalid' })
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Identifiant Google Docs invalide.'
  });
});

test('le handler mesure aussi un corps sans en-tête Content-Length', async () => {
  const response = await handler(new Request('https://evalvoice.test/api/fetch-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: 'x'.repeat(3_000) })
  }));

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    error: 'Requête trop volumineuse.'
  });
});
