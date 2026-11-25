import type { PDFDocumentProxy } from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import { findCompressionTarget } from "./compression-target";
import { pdfBytesToBlob } from "./pdf-utils";
import { runPdfEngine } from "./pdf-engine";
import { canvasBytes, openPdf, renderPdfCanvas } from "./pdf-render";

const rasterPresets = [
  { scale: 2, quality: 0.84 },
  { scale: 1.45, quality: 0.68 },
  { scale: 1.0, quality: 0.48 },
];

export const scanLevels = [
  { label: "Sharp", index: 0 },
  { label: "Balanced", index: 1 },
  { label: "Small", index: 2 },
] as const;

export type CompressionOptions =
  | { mode: "text" }
  | { mode: "scan"; level: number; targetBytes?: number };

type Progress = (percent: number, message: string) => void;

async function renderCopy(
  pdf: PDFDocumentProxy,
  preset: { scale: number; quality: number },
  pass: number,
  passes: number,
  onProgress: Progress,
) {
  const output = await PDFDocument.create();
  for (let number = 1; number <= pdf.numPages; number++) {
    const done = pass * pdf.numPages + number - 1;
    const passLabel = passes > 1 ? "Testing quality " + (pass + 1) + " · " : "";
    onProgress(10 + Math.round(84 * done / (passes * pdf.numPages)), passLabel + "Page " + number + " of " + pdf.numPages);
    const page = await pdf.getPage(number);
    const { canvas, original } = await renderPdfCanvas(page, 4096, preset.scale);
    try {
      const jpeg = await canvasBytes(canvas, "image/jpeg", preset.quality);
      const image = await output.embedJpg(await jpeg.arrayBuffer());
      output.addPage([original.width, original.height]).drawImage(image, { x: 0, y: 0, width: original.width, height: original.height });
    } finally {
      canvas.width = canvas.height = 0;
      page.cleanup();
    }
  }
  onProgress(10 + Math.round(84 * (pass + 1) / passes), "Saving the candidate PDF…");
  return pdfBytesToBlob(await output.save({ useObjectStreams: true, addDefaultPage: false }));
}

export async function compressPdf(file: File, options: CompressionOptions, onProgress: Progress) {
  onProgress(5, "Opening PDF…");
  if (options.mode === "text") {
    const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    onProgress(65, "Optimizing the PDF structure…");
    const { blob } = await runPdfEngine(file, "optimize");
    return { blob: blob.size < file.size ? blob : file, pages: doc.getPageCount() };
  }

  const task = await openPdf(file);
  try {
    const pdf = await task.promise;
    const blob: Blob = options.targetBytes
      ? await findCompressionTarget<Blob>(file, options.targetBytes, (quality, pass, count) =>
          renderCopy(pdf, { scale: 0.45 + quality * 2.8, quality: 0.23 + quality * 0.74 }, pass, count, onProgress))
      : await renderCopy(pdf, rasterPresets[options.level], 0, 1, onProgress);
    onProgress(100, "Ready.");
    return { blob: blob.size < file.size ? blob : file, pages: pdf.numPages };
  } finally {
    await task.destroy().catch(() => {});
  }
}