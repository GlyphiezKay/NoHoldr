export type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "bmp" | "gif" | "svg" | "ico";
export const imageFormats = {
  jpeg: { mime: "image/jpeg", ext: "jpg", label: "JPEG" },
  png: { mime: "image/png", ext: "png", label: "PNG" },
  webp: { mime: "image/webp", ext: "webp", label: "WebP" },
  avif: { mime: "image/avif", ext: "avif", label: "AVIF" },
  bmp: { mime: "image/bmp", ext: "bmp", label: "BMP" },
  gif: { mime: "image/gif", ext: "gif", label: "GIF (single frame)" },
  svg: { mime: "image/svg+xml", ext: "svg", label: "SVG (embedded raster)" },
  ico: { mime: "image/x-icon", ext: "ico", label: "ICO" },
} satisfies Record<ImageFormat, { mime: string; ext: string; label: string }>;

export function makeImageCanvas(width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
    width > 16_384 || height > 16_384 || width * height > 32_000_000) {
    throw new Error("Output exceeds the limit of 32 megapixels or 16,384 px per side.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not create an image canvas.");
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

export async function openLocalImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = new window.Image();
  try {
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
    return image;
  } catch {
    throw new Error("This browser could not decode the image. Check the file or try PNG, JPEG, or WebP.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function encodeCanvas(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) reject(new Error("The image encoder failed."));
      else if (blob.type !== mime) reject(new Error("This browser cannot export " + mime.replace("image/", "").toUpperCase() + ". Choose a different format."));
      else resolve(blob);
    }, mime, quality);
  });
}

function pixels(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not read the image canvas.");
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

function bitmapFile(canvas: HTMLCanvasElement) {
  const { width, height } = canvas;
  const rgba = pixels(canvas);
  const stride = Math.ceil(width * 3 / 4) * 4;
  const bytes = new Uint8Array(54 + stride * height);
  const header = new DataView(bytes.buffer);
  bytes.set([66, 77]);
  header.setUint32(2, bytes.length, true);
  header.setUint32(10, 54, true);
  header.setUint32(14, 40, true);
  header.setInt32(18, width, true);
  header.setInt32(22, -height, true);
  header.setUint16(26, 1, true);
  header.setUint16(28, 24, true);
  header.setUint32(34, stride * height, true);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4, dest = 54 + y * stride + 3 * x;
      bytes[dest] = rgba[source + 2];
      bytes[dest + 1] = rgba[source + 1];
      bytes[dest + 2] = rgba[source];
    }
  }
  return new Blob([bytes], { type: "image/bmp" });
}

async function iconFile(canvas: HTMLCanvasElement) {
  const png = await encodeCanvas(canvas, "image/png");
  const header = new DataView(new ArrayBuffer(22));
  header.setUint16(2, 1, true);
  header.setUint16(4, 1, true);
  header.setUint8(6, canvas.width === 256 ? 0 : canvas.width);
  header.setUint8(7, canvas.height === 256 ? 0 : canvas.height);
  header.setUint16(10, 1, true);
  header.setUint16(12, 32, true);
  header.setUint32(14, png.size, true);
  header.setUint32(18, 22, true);
  return new Blob([header.buffer, png], { type: "image/x-icon" });
}

async function avifFile(canvas: HTMLCanvasElement, quality: number) {
  const rgba = pixels(canvas);
  const worker = new Worker("/image-codec/avif-worker.mjs", { type: "module" });
  try {
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<{ bytes: ArrayBuffer } | { error: string }>) => {
        if ("error" in data) reject(new Error(data.error));
        else resolve(data.bytes);
      };
      worker.onerror = event => {
        event.preventDefault();
        reject(new Error("Could not load the local AVIF encoder."));
      };
      worker.onmessageerror = () => reject(new Error("The local AVIF encoder returned an unreadable result."));
      worker.postMessage({ pixels: rgba.buffer, width: canvas.width, height: canvas.height, quality: Math.round(quality * 100) }, [rgba.buffer]);
    });
    return new Blob([bytes], { type: "image/avif" });
  } finally {
    worker.terminate();
  }
}

export async function gifFile(frames: Iterable<HTMLCanvasElement> | AsyncIterable<HTMLCanvasElement>, delay: number, repeat = 0) {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const encoder = GIFEncoder();
  let count = 0;
  for await (const frame of frames) {
    const rgba = pixels(frame);
    const palette = quantize(rgba, 256);
    encoder.writeFrame(applyPalette(rgba, palette), frame.width, frame.height, { palette, delay, repeat });
    count++;
  }
  if (!count) throw new Error("The GIF needs at least one frame.");
  encoder.finish();
  return new Blob([Uint8Array.from(encoder.bytes()).buffer], { type: "image/gif" });
}

export async function exportCanvas(canvas: HTMLCanvasElement, format: ImageFormat, quality: number) {
  if (format === "avif") return avifFile(canvas, quality);
  if (format === "bmp") return bitmapFile(canvas);
  if (format === "ico") return iconFile(canvas);
  if (format === "gif") return gifFile([canvas], 0, -1);
  if (format === "svg") {
    const { width, height } = canvas;
    const embedded = canvas.toDataURL("image/png");
    return new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
      '"><image href="' + embedded + '" width="' + width + '" height="' + height + '"/></svg>'], { type: "image/svg+xml" });
  }
  return encodeCanvas(canvas, imageFormats[format].mime, quality);
}

export function imageOutputName(file: File, suffix: string, format: ImageFormat) {
  return file.name.replace(/\.[^.]+$/, "") + suffix + "." + imageFormats[format].ext;
}

export function opaqueFormat(format: ImageFormat) {
  return format === "jpeg" || format === "bmp" || format === "gif";
}

export function uniqueImageName(name: string, used: Set<string>) {
  const safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  const split = safe.lastIndexOf(".");
  const stem = split > 0 ? safe.slice(0, split) : safe, extension = split > 0 ? safe.slice(split) : "";
  let next = safe;
  for (let n = 2; used.has(next.toLowerCase()); n++) next = stem + "_" + n + extension;
  used.add(next.toLowerCase());
  return next;
}
