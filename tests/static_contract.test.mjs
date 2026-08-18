import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../scripts/evalvoice.mjs', import.meta.url), 'utf8');
const build = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');

test('la page ne charge aucun script tiers et ne contient aucun gestionnaire inline', () => {
  assert.doesNotMatch(html, /https?:\/\/(?:cdnjs|unpkg|jsdelivr)/iu);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/iu);
  assert.doesNotMatch(html, /<script(?![^>]+src=)[^>]*>/iu);
});

test('tous les identifiants utilisés par le cache DOM existent dans la page', () => {
  const idsMatch = app.match(/const ids = \[([\s\S]*?)\];/u);
  assert.ok(idsMatch, 'La liste des identifiants doit rester détectable par ce test.');
  const ids = [...idsMatch[1].matchAll(/'([^']+)'/gu)].map((match) => match[1]);

  for (const id of ids) {
    assert.match(html, new RegExp(`id=["']${id}["']`, 'u'), `#${id} est absent`);
  }
});

test('la réponse est une zone multiligne et le sélecteur PDF reste accessible', () => {
  assert.match(html, /<textarea[\s\S]*?id="responseInput"/u);
  assert.match(html, /<input id="fileInput" type="file"/u);
  assert.doesNotMatch(html, /id="fileInput"[^>]+display\s*:\s*none/iu);
});

test('la boîte de validation et la progression ont un nom accessible', () => {
  assert.match(
    html,
    /<dialog[\s\S]*?aria-labelledby="reviewDialogTitle"/u
  );
  assert.match(html, /<h2 id="reviewDialogTitle">/u);
  assert.match(
    html,
    /<progress[\s\S]*?aria-labelledby="progressText"/u
  );
});

test('le build embarque les deux polices Unicode et leur licence', () => {
  assert.match(build, /DejaVuSans\.ttf/u);
  assert.match(build, /DejaVuSans-Bold\.ttf/u);
  assert.match(build, /DejaVu-LICENSE\.txt/u);
  assert.match(build, /scripts\/pdf_export\.mjs/u);
});


test('le pied de page identifie le développeur, la licence et le code source', () => {
  assert.match(html, /<footer[^>]+class="app-footer"/u);
  assert.match(html, /Développé par <strong>Jérémy VIOLETTE<\/strong>/u);
  assert.match(html, /src="IMG\/logo_dev\.png"/u);
  assert.match(html, /EvalVoice\/blob\/main\/LICENSE/u);
  assert.match(html, />Licence MIT<\/a>/u);
  assert.match(html, />Code source<\/a>/u);
test('les PDF locaux et Google Docs partagent la limite de 20 Mo', () => {
  assert.match(app, /MAX_LOCAL_PDF_SIZE\s*=\s*20\s*\*\s*1024\s*\*\s*1024/u);
  assert.match(app, /MAX_REMOTE_PDF_SIZE\s*=\s*20\s*\*\s*1024\s*\*\s*1024/u);
  assert.match(html, /export PDF ne doit pas\s+dépasser 20 Mo/u);
});
