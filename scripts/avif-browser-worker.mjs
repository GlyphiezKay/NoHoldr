import createEncoder from "./avif_enc.js";

self.onmessage = async ({ data: { pixels, width, height, quality } }) => {
  try {
    const encoder = await createEncoder();
    const result = encoder.encode(new Uint8Array(pixels), width, height, {
      quality, qualityAlpha: -1, denoiseLevel: 0, tileColsLog2: 0, tileRowsLog2: 0, speed: 8,
      subsample: 1, chromaDeltaQ: false, sharpness: 0, tune: 0, enableSharpYUV: false, bitDepth: 8, lossless: false,
    });
    if (!result) throw new Error("No AVIF produced");
    const bytes = Uint8Array.from(result).buffer;
    self.postMessage({ bytes }, [bytes]);
  } catch {
    self.postMessage({ error: "The local AVIF encoder could not process this image." });
  }
};