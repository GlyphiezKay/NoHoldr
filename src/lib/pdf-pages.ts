import { PDFDocument, type PDFPage } from "pdf-lib";
import { pdfBytesToBlob } from "./pdf-utils";
import { canvasBytes, openPdf, renderPdfCanvas } from "./pdf-render";

export function parsePdfPages(input: string, total: number): number[] {
  const result = new Set<number>();
  for (const token of input.split(",")) {
    const match = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Use page numbers or ranges such as 1, 4-6.");
    const start = Number(match[1]);
    const end = Number(match[2] ?? start);
    if (start < 1 || end < start || end > total) throw new Error("Choose pages from 1 to " + total + ".");
    for (let n = start; n <= end; n++) result.add(n);
  }
  return [...result];
}

export async function extractPdf(file: File, selection: string) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const indices = parsePdfPages(selection, source.getPageCount()).map(n => n - 1);
  const output = await PDFDocument.create();
  for (const page of await output.copyPages(source, indices)) output.addPage(page);
  return pdfBytesToBlob(await output.save({ addDefaultPage: false }));
}

export type Region = { left: number; top: number; width: number; height: number };
export type Redaction = { page: number; region: Region };

function cropPage(page: PDFPage, region: Region) {
  const { x, y, width, height } = page.getCropBox();
  const { left: a, top: b, width: c, height: d } = region;
  let box;
  switch ((page.getRotation().angle % 360 + 360) % 360) {
    case 90: box = [b, a, d, c]; break;
    case 180: box = [1 - a - c, b, c, d]; break;
    case 270: box = [1 - b - d, 1 - a - c, d, c]; break;
    default: box = [a, 1 - b - d, c, d];
  }
  page.setCropBox(x + box[0] * width, y + box[1] * height, box[2] * width, box[3] * height);
}

export async function cropPdf(file: File, selection: string, region: Region) {
  const source = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  for (const n of parsePdfPages(selection, source.getPageCount())) cropPage(source.getPage(n - 1), region);
  return pdfBytesToBlob(await source.save({ updateFieldAppearances: false }));
}

export async function redactPdf(file: File, redactions: Redaction[], report: (page: number, total: number) => void) {
  const task = await openPdf(file);
  try {
    const source = await task.promise;
    const output = await PDFDocument.create();
    for (let n = 1; n <= source.numPages; n++) {
      report(n, source.numPages);
      const page = await source.getPage(n);
      const { canvas, original } = await renderPdfCanvas(page, 3600, 2.5);
      try {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("The browser could not open the PDF canvas.");
        ctx.fillStyle = "#000";
        for (const { page: number, region } of redactions) {
          if (number !== n) continue;
          const x = Math.floor(region.left * canvas.width);
          const y = Math.floor(region.top * canvas.height);
          ctx.fillRect(x, y, Math.ceil((region.left + region.width) * canvas.width) - x, Math.ceil((region.top + region.height) * canvas.height) - y);
        }
        const image = await output.embedPng(await (await canvasBytes(canvas)).arrayBuffer());
        output.addPage([original.width, original.height]).drawImage(image, { x: 0, y: 0, width: original.width, height: original.height });
      } finally {
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
    }
    return pdfBytesToBlob(await output.save());
  } finally {
    await task.destroy().catch(() => {});
  }
}