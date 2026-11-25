import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
copyFileSync(source, new URL('../public/pdf.worker.min.mjs', import.meta.url));

const engine = new URL('../public/pdf-engine/', import.meta.url);
mkdirSync(new URL('ocr/', engine), { recursive: true });
const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json'));
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
    cpSync(join(pdfjsDir, directory), fileURLToPath(new URL(directory, engine)), { recursive: true });
}
const qpdfDir = dirname(require.resolve('@arshad-shah/qpdf-wasm/qpdf.wasm'));
for (const name of ['index.js', 'qpdf.js', 'qpdf.wasm']) {
    copyFileSync(join(qpdfDir, name), new URL(name, engine));
}
copyFileSync(join(qpdfDir, '..', 'LICENSE'), new URL('qpdf-LICENSE.txt', engine));
cpSync(join(qpdfDir, '..', 'THIRD_PARTY_LICENSES'), fileURLToPath(new URL('qpdf-third-party/', engine)), { recursive: true });
copyFileSync(new URL('./qpdf-browser-worker.mjs', import.meta.url), new URL('qpdf-worker.mjs', engine));
copyFileSync(require.resolve('tesseract.js/dist/worker.min.js'), new URL('ocr/worker.min.js', engine));
copyFileSync(require.resolve('tesseract.js/LICENSE.md'), new URL('ocr/LICENSE.txt', engine));
copyFileSync(new URL('./ocr-browser-worker.js', import.meta.url), new URL('ocr/ocr-worker.js', engine));
const ocrCore = dirname(require.resolve('tesseract.js-core/package.json'));
copyFileSync(join(ocrCore, 'LICENSE'), new URL('ocr/core-LICENSE.txt', engine));
for (const variant of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
    const name = `tesseract-core-${variant}.wasm.js`;
    copyFileSync(join(ocrCore, name), new URL(`ocr/${name}`, engine));
}
for (const lang of ['eng', 'ind']) {
    const data = dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
    const compressed = readFileSync(join(data, '4.0.0_best_int', `${lang}.traineddata.gz`));
    writeFileSync(new URL(`ocr/${lang}.model.json`, engine), JSON.stringify(compressed.toString('base64')));
}

const imageCodec = new URL('../public/image-codec/', import.meta.url);
mkdirSync(imageCodec, { recursive: true });
const avif = dirname(require.resolve('@jsquash/avif/package.json'));
for (const name of ['avif_enc.js', 'avif_enc.wasm']) {
    copyFileSync(join(avif, 'codec', 'enc', name), new URL(name, imageCodec));
}
copyFileSync(join(avif, 'LICENSE'), new URL('AVIF-LICENSE.txt', imageCodec));
copyFileSync(new URL('./avif-browser-worker.mjs', import.meta.url), new URL('avif-worker.mjs', imageCodec));
