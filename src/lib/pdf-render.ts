import type { PDFPageProxy } from "pdfjs-dist";

export async function openPdf(file: File) {
  const { pdfjsLib } = await import("./pdfjs-setup");
  return pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    cMapUrl: "/pdf-engine/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdf-engine/standard_fonts/",
    wasmUrl: "/pdf-engine/wasm/",
  });
}

export async function renderPdfCanvas(page: PDFPageProxy, maxSide: number, preferredScale = 2) {
  const original = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(preferredScale, maxSide / Math.max(original.width, original.height)) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  await page.render({ canvas, viewport, background: "white", annotationMode: 1 }).promise;
  return { canvas, viewport, original };
}

export function canvasBytes(canvas: HTMLCanvasElement, format = "image/png", quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The browser could not encode the page.")), format, quality);
  });
}
