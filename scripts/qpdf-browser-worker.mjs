// This module and the qpdf distribution are served from the same directory.
import { check, configure, decrypt, encrypt, inspect, optimize, run } from './index.js';

configure({ wasmUrl: new URL('./qpdf.wasm', import.meta.url) });

self.onmessage = async ({ data: { input, operation, password } }) => {
    try {
        const bytes = new Uint8Array(input);
        let result;
        if (operation === 'protect') {
            const ownerPassword = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
            result = await encrypt(bytes, { userPassword: password, ownerPassword });
        } else if (operation === 'unlock') {
            const info = await inspect(bytes, password);
            if (!info.encrypted) throw new Error('This PDF is already unencrypted.');
            result = await decrypt(bytes, password);
        } else if (operation === 'optimize') {
            result = await optimize(bytes, { objectStreams: 'generate', compressStreams: true, recompressFlate: true });
        } else if (operation === 'repair') {
            const attempt = await run(['input.pdf', '--object-streams=generate', 'recovered.pdf'], { 'input.pdf': bytes });
            const recovered = attempt.files['recovered.pdf'];
            if (![0, 3].includes(attempt.exitCode) || !recovered) {
                throw new Error('The PDF could not be recovered. Try a different copy.');
            }
            const validated = await check(recovered);
            result = { bytes: recovered, warnings: [...attempt.stderr.split(/\r?\n/).filter(Boolean), ...validated.warnings] };
        } else {
            throw new Error('Unsupported PDF operation.');
        }
        const output = Uint8Array.from(result.bytes).buffer;
        self.postMessage({ output, warnings: result.warnings.length }, [output]);
    } catch (error) {
        const message = error?.code === 'WRONG_PASSWORD' ? 'The PDF password is incorrect.' :
            operation === 'unlock' && password === '' && error?.code === 'QPDF_ERROR' ? 'Enter the PDF’s current password.' :
            operation === 'repair' && error?.code === 'QPDF_ERROR' ? 'The repaired file could not pass a structural check.' :
            error?.code === 'WASM_ERROR' ? 'The local PDF engine could not start. Reload and try again.' :
            error?.code === 'QPDF_ERROR' ? 'The engine could not open this PDF. Check whether it is encrypted or damaged.' :
            error?.message || 'The PDF operation failed.';
        self.postMessage({ error: message });
    }
};