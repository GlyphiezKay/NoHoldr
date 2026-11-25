import { PDFDocument, radians, StandardFonts } from "pdf-lib";
import { pdfBytesToBlob } from "./pdf-utils";
import { openPdf, renderPdfCanvas } from "./pdf-render";

export async function recognizePdf(
  file: File,
  language: "eng" | "ind" | "eng+ind",
  report: (progress: number, message: string) => void,
) {
  const { createWorker, OEM } = await import("tesseract.js");
  const assets = new URL("/pdf-engine/ocr/", window.location.origin);
  const task = await openPdf(file);
  try {
    const source = await task.promise;
    const output = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    const font = await output.embedFont(StandardFonts.Helvetica);
    let activePage = 0;
    let recognizedPages = 0;
    let recognizedWords = 0;
    const transcripts: string[] = [];
    report(4, "Loading OCR engine and language data…");
    const worker = await new Promise<Awaited<ReturnType<typeof createWorker>>>((resolve, reject) => {
      createWorker(language, OEM.LSTM_ONLY, {
        corePath: assets.href,
        langPath: assets.href,
        workerPath: new URL("ocr-worker.js", assets).href,
        workerBlobURL: false,
        cacheMethod: "none",
        logger: message => {
          if (message.status === "recognizing text") {
            report(8 + Math.round(88 * (activePage - 1 + message.progress) / source.numPages), "Recognizing page " + activePage + " of " + source.numPages + "…");
          }
        },
        errorHandler: reason => reject(new Error(String(reason))),
      }).then(resolve, reject);
    });
    try {
      for (let n = 1; n <= source.numPages; n++) {
        activePage = n;
        report(8 + Math.round(88 * (n - 1) / source.numPages), "Reading page " + n + " of " + source.numPages + "…");
        const page = await source.getPage(n);
        const existing = await page.getTextContent();
        const text = existing.items.flatMap(item => "str" in item ? [item.str + (item.hasEOL ? "\n" : " ")] : []).join("").trim();
        if (text) {
          transcripts.push(text);
          page.cleanup();
          continue;
        }
        const { canvas, viewport } = await renderPdfCanvas(page, 2800, 2.25);
        try {
          const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
          transcripts.push(data.text.trim());
          let placed = 0;
          for (const block of data.blocks ?? []) {
            for (const paragraph of block.paragraphs) {
              for (const line of paragraph.lines) {
                for (const word of line.words) {
                  const text = Array.from(word.text).filter(char => {
                    try { font.encodeText(char); return true; } catch { return false; }
                  }).join("").trim();
                  if (!text) continue;
                  const { x0, y0, x1, y1 } = word.bbox;
                  const [x, y] = viewport.convertToPdfPoint(x0, y1);
                  const [endX, endY] = viewport.convertToPdfPoint(x1, y1);
                  const [topX, topY] = viewport.convertToPdfPoint(x0, y0);
                  output.getPage(n - 1).drawText(text, {
                    x, y, font, opacity: 0,
                    size: Math.max(1, Math.hypot(topX - x, topY - y)),
                    rotate: radians(Math.atan2(endY - y, endX - x)),
                  });
                  placed++;
                }
              }
            }
          }
          if (placed) recognizedPages++;
          recognizedWords += placed;
        } finally {
          canvas.width = canvas.height = 0;
          page.cleanup();
        }
      }
      report(97, "Saving searchable PDF…");
      const blob = recognizedWords ? pdfBytesToBlob(await output.save({ addDefaultPage: false, updateFieldAppearances: false })) : file;
      return { blob, recognizedPages, words: recognizedWords, transcript: transcripts.join("\n\n") };
    } finally {
      await worker.terminate();
    }
  } finally {
    await task.destroy().catch(() => {});
  }
}
