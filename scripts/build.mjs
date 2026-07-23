import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, 'dist');

async function copy(relativeSource, relativeDestination = relativeSource) {
  const source = join(projectRoot, relativeSource);
  const destination = join(outputRoot, relativeDestination);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

await Promise.all([
  copy('index.html'),
  copy('IMG'),
  copy('styles'),
  copy('scripts/evalvoice.mjs'),
  copy('scripts/pdf_extractor.mjs'),
  copy('scripts/question_parser.mjs'),
  copy('scripts/session_store.mjs'),
  copy('node_modules/pdfjs-dist/build/pdf.mjs', 'vendor/pdfjs/pdf.mjs'),
  copy('node_modules/pdfjs-dist/build/pdf.worker.mjs', 'vendor/pdfjs/pdf.worker.mjs'),
  copy('node_modules/jspdf/dist/jspdf.umd.min.js', 'vendor/jspdf/jspdf.umd.min.js')
]);

console.log('EvalVoice construit dans dist/.');
