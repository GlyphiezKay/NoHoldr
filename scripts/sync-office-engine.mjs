import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, rename, rm, rmdir, readFile, writeFile } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

const repo = 'eze-paz/libreoffice-wasm';
const commit = 'f01a1827a39d4d9edede31a3512b9c9151ca31b9';
const release = 'v0.2.0';
const root = new URL('../public/pdf-engine/office/', import.meta.url);
const binaries = {
    'soffice.data.gz': '853808776c063a5a9d3268edeef8b935c2e8642cb1b39f69136b1c75f72876eb',
    'soffice.data.js.metadata.gz': '3fd87295c32661396afe619810b604761520c1c56061f7a90d1690546c587c30',
    'soffice.js.gz': 'edac977a054d0368bcb888dde14dd0316dd7b3239b893f1477996d8f44ea1fb6',
    'soffice.wasm.gz': 'e1c64d5c9b6064165c5db990f4ec7906c33808dab7e1e54a77e1f77d7f4b91d4',
};
const sources = {
    'engine.html': 'fa9a8c2e3f26ecb815a337f0960cc9b188831bf6a8f2ffda7d67abc1e0012450',
    'coop.js': 'a7ed1badf4b3d5bf7d2c4117e097d0aaa724e0f26cf6f216fe5e9fae9f110a2b',
    'LICENSE': '5dbbc09136fa6cbb2b010dbdac08ad6a75c042eeb33fde81dfe82bb3eb819c46',
};

async function download(url, file, digest) {
    const response = await fetch(url, { signal: AbortSignal.timeout(240_000) });
    if (!response.ok || !response.body) throw new Error('Office engine download failed (' + response.status + '): ' + url);
    const hash = createHash('sha256');
    await pipeline(Readable.fromWeb(response.body), new Transform({
        transform(chunk, _encoding, callback) {
            hash.update(chunk);
            callback(null, chunk);
        },
    }), createWriteStream(file));
    if (hash.digest('hex') !== digest) throw new Error('Office engine checksum mismatch: ' + url);
}

async function sync() {
    const stamp = new URL('version.txt', root);
    const build = release + ':' + commit + ':3';
    const paths = [...Object.keys(sources), ...Object.keys(binaries).map(name =>
        name === 'soffice.data.gz' ? 'bin/office-data.json' : 'bin/' + name.slice(0, -3))];
    try {
        if (await readFile(stamp, 'utf8') === build) {
            await Promise.all(paths.map(path => access(new URL(path, root))));
            return;
        }
    } catch {
        // Prepare missing assets from the pinned upstream release below.
    }
    await mkdir(new URL('bin/', root), { recursive: true });
    const staging = new URL('.sync-' + process.pid + '/', root);
    await mkdir(staging, { recursive: true });
    try {
        const tasks = [
            ...Object.entries(sources).map(async ([name, digest]) => {
                const local = new URL(name, staging);
                await download('https://raw.githubusercontent.com/' + repo + '/' + commit + '/' + name, local, digest);
                if (name === 'engine.html') {
                    const html = await readFile(local, 'utf8');
                    const restricted = html.replace("parent.postMessage(msg, '*', transfer || [])", "parent.postMessage(msg, location.origin, transfer || [])")
                        .replace("if (!d || d.type !== 'lo-run' || job) return;", "if (e.source !== parent || e.origin !== location.origin || !d || d.type !== 'lo-run' || job) return;")
                        .replace("addEventListener('message', (e) =>", "addEventListener('message', async (e) =>")
                        .replace("    window.Module = {", `    let packageBytes;
    try {
      const response = await fetch(BIN + 'office-data.json?v=' + V);
      if (!response.ok) throw new Error('Office assets are unavailable');
      const chunks = (await response.json()).map(chunk => Uint8Array.from(atob(chunk), char => char.charCodeAt(0)));
      packageBytes = await new Response(new Blob(chunks).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    } catch (error) {
      finish(-1, 'Could not load the Office data package: ' + error.message);
      return;
    }
    window.Module = {
      getPreloadedPackage: () => {
        const bytes = packageBytes;
        packageBytes = null;
        return bytes;
      },`);
                    if (restricted === html) throw new Error('Office engine message restrictions could not be applied.');
                    await writeFile(local, restricted);
                }
                await rename(local, new URL(name, root));
            }),
            ...Object.entries(binaries).map(async ([name, digest]) => {
                const local = new URL(name, staging);
                const extracted = new URL(name.slice(0, -3), staging);
                await download('https://github.com/' + repo + '/releases/download/' + release + '/' + name, local, digest);
                if (name === 'soffice.data.gz') {
                    const compressed = await readFile(local);
                    const chunks = [];
                    for (let offset = 0; offset < compressed.length; offset += 1024 * 1024) {
                        chunks.push(compressed.subarray(offset, offset + 1024 * 1024).toString('base64'));
                    }
                    await writeFile(extracted, JSON.stringify(chunks));
                    await rename(extracted, new URL('bin/office-data.json', root));
                } else {
                    await pipeline(createReadStream(local), createGunzip(), createWriteStream(extracted));
                    await rename(extracted, new URL('bin/' + name.slice(0, -3), root));
                }
            }),
        ];
        const results = await Promise.allSettled(tasks);
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
        await writeFile(stamp, build);
    } finally {
        const temporaryFiles = [...Object.keys(sources), ...Object.keys(binaries).flatMap(name => [name, name.slice(0, -3)])];
        await Promise.all(temporaryFiles.map(name => rm(new URL(name, staging), { force: true })));
        await rmdir(staging);
    }
}

await sync();
