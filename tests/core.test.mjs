import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const load = async path => {
    const source = stripTypeScriptTypes(readFileSync(new URL(path, import.meta.url), 'utf8'));
    return import(`data:text/javascript,${encodeURIComponent(source)}`);
};

test('CSV conversion preserves quoted fields, multiline values and all columns', async () => {
    const { csvToJSON, jsonToCSV } = await load('../src/lib/csv-utils.ts');
    const rows = csvToJSON(jsonToCSV([{ name: 'A,B', note: 'first\nsecond', quote: '"test"' }, { name: 'Z', extra: 123 }]));
    assert.deepEqual(rows, [
        { name: 'A,B', note: 'first\nsecond', quote: '"test"', extra: '' },
        { name: 'Z', note: '', quote: '', extra: '123' },
    ]);
});

test('CSV rejects incomplete records and handles BOM and CRLF', async () => {
    const { parseCSV } = await load('../src/lib/csv-utils.ts');
    assert.deepEqual(parseCSV('\uFEFFa,b\r\n1,2\r\n'), { headers: ['a', 'b'], rows: [['1', '2']] });
    assert.throws(() => parseCSV('a,b\n1'));
    assert.throws(() => parseCSV('a\n"bad'));
});

test('file detection handles generic and modern MIME types', async () => {
    const { detectFileType } = await load('../src/lib/file-detector.ts');
    assert.equal(detectFileType(new File([], 'x.avif', { type: 'image/avif' })).category, 'image');
    assert.equal(detectFileType(new File([], 'x.csv', { type: 'text/plain' })).category, 'data');
    assert.equal(detectFileType(new File([], 'constructor')).category, 'unsupported');
});

test('video encoder reports unsupported runtime before allocating resources', async () => {
    const { recordVideo } = await load('../src/lib/video-utils.ts');
    await assert.rejects(recordVideo(new File([], 'video.mp4')), /does not support/);
});

test('CSV round-trips a single empty value and rejects zero-column objects', async () => {
    const { csvToJSON, jsonToCSV } = await load('../src/lib/csv-utils.ts');
    assert.deepEqual(csvToJSON(jsonToCSV([{ value: '' }])), [{ value: '' }]);
    assert.throws(() => jsonToCSV([{}]), /at least one column/);
});

test('file detection recognizes modern extensions without MIME metadata', async () => {
    const { detectFileType } = await load('../src/lib/file-detector.ts');
    for (const extension of ['avif', 'heic', 'tif']) {
        assert.equal(detectFileType(new File([], `image.${extension}`)).category, 'image');
    }
    assert.equal(detectFileType(new File([], 'readme.md')).category, 'data');
});

test('Base64 handles Unicode, data URLs, empty values and invalid UTF-8', async () => {
    const { encodeBase64Text, decodeBase64Text, decodeBase64Bytes } = await load('../src/lib/base64-utils.ts');
    const text = 'Halo 世界 🌏';
    assert.equal(decodeBase64Text(encodeBase64Text(text)), text);
    assert.equal(decodeBase64Text('data:text/plain;base64,SGFsbw=='), 'Halo');
    assert.equal(decodeBase64Text(''), '');
    assert.deepEqual([...decodeBase64Bytes('/w==')], [255]);
    assert.throws(() => decodeBase64Text('/w=='));
});

test('bundled PDF worker matches installed PDF.js', () => {
    const require = createRequire(import.meta.url);
    const { version } = require('pdfjs-dist/package.json');
    const worker = readFileSync(new URL('../public/pdf.worker.min.mjs', import.meta.url), 'utf8');
    const installedWorker = readFileSync(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), 'utf8');
    assert.ok(worker.replaceAll('\r\n', '\n') === installedWorker, 'Bundled worker differs from the installed PDF.js worker');
    assert.equal(worker.match(/pdfjsVersion\s*=\s*([\d.]+)/)?.[1], version);
});

test('PDF size targeting improves on the first result below the cap', async () => {
    const { findCompressionTarget } = await load('../src/lib/compression-target.ts');
    const original = { size: 1_200_000 };
    const encode = async quality => ({ size: Math.round(40_000 + 960_000 * quality ** 2) });
    const result = await findCompressionTarget(original, 700_000, encode);
    assert.ok(result.size >= 680_000 && result.size <= 700_000);
    assert.equal(await findCompressionTarget(original, 1_300_000, encode), original);
    assert.equal((await findCompressionTarget(original, 10_000, encode)).size, 40_000);
});

test("archive filenames preserve extensions and avoid case-insensitive overwrites", async () => {
  const { uniqueFileName } = await import("../src/lib/file-utilities.ts");
  const used = new Set();
  assert.equal(uniqueFileName("Report.txt", used), "Report.txt");
  assert.equal(uniqueFileName("report.TXT", used), "report (2).TXT");
  assert.equal(uniqueFileName("folder/report.txt", used), "folder_report.txt");
  assert.equal(uniqueFileName(".env", used), ".env");
});

test("WAV encoding preserves frame count, PCM bit depth, and RIFF padding", async () => {
  const { encodeWav } = await import("../src/lib/audio-export.ts");
  const input = {
    length: 3,
    sampleRate: 8000,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array([-1, 0, 1]),
  };
  const bytes = new Uint8Array(await encodeWav(input, { depth: 8 }).arrayBuffer());
  const header = new DataView(bytes.buffer);
  assert.equal(header.getUint32(4, true), 40);
  assert.equal(header.getUint32(40, true), 3);
  assert.deepEqual([...bytes.slice(44)], [0, 128, 255, 0]);
});
