import { openPdf, renderPdfCanvas } from "./pdf-render";

export type ExportFormat = "markdown" | "word" | "slides" | "excel";

export async function readPdfLines(file: File, report: (page: number, total: number) => void) {
  const task = await openPdf(file);
  try {
    const pdf = await task.promise;
    const pages: Array<Array<{ text: string; x: number; y: number; size: number; width: number }>> = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      report(n, pdf.numPages);
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const tokens = content.items.flatMap(item => {
        if (!("str" in item) || !item.str.trim()) return [];
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        return [{ text: item.str, x, y, size: Math.max(1, item.height), width: item.width }];
      });
      pages.push(tokens);
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy().catch(() => {});
  }
}

type Token = Awaited<ReturnType<typeof readPdfLines>>[number][number];

function rowsOf(tokens: Token[]) {
  const ordered = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Token[][] = [];
  for (const token of ordered) {
    const last = rows.at(-1);
    if (last && Math.abs(token.y - last[0].y) <= Math.min(4, Math.max(1.5, token.size * 0.2))) last.push(token);
    else rows.push([token]);
  }
  return rows.map(row => row.sort((a, b) => a.x - b.x));
}

function rowText(row: Token[]) {
  return row.map(item => item.text.trim()).join(" ");
}

function tableCells(row: Token[]) {
  const cells: Token[] = [];
  for (const item of row) {
    const prev = cells.at(-1);
    if (prev && item.x - prev.x - prev.width <= Math.max(8, prev.size * 0.75)) {
      prev.text += " " + item.text.trim();
      prev.width = Math.max(prev.width, item.x + item.width - prev.x);
    } else cells.push({ ...item, text: item.text.trim() });
  }
  return cells;
}

async function slides(file: File, report: (page: number, total: number) => void) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const deck = new PptxGenJS();
  deck.layout = "LAYOUT_WIDE";
  deck.title = file.name.replace(/\.pdf$/i, "");
  const task = await openPdf(file);
  try {
    const pdf = await task.promise;
    for (let number = 1; number <= pdf.numPages; number++) {
      report(number, pdf.numPages);
      const page = await pdf.getPage(number);
      const { canvas } = await renderPdfCanvas(page, 1760);
      try {
        const slide = deck.addSlide();
        const data = canvas.toDataURL("image/png");
        const ratio = Math.min(13.333333 / canvas.width, 7.5 / canvas.height);
        const w = canvas.width * ratio, h = canvas.height * ratio;
        slide.addImage({ data, x: (13.333333 - w) / 2, y: (7.5 - h) / 2, w, h });
      } finally {
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
    }
    return await deck.write({ outputType: "blob", compression: true }) as Blob;
  } finally {
    await task.destroy().catch(() => {});
  }
}

export async function exportPdf(file: File, format: ExportFormat, report: (page: number, total: number) => void) {
  if (format === "slides") return slides(file, report);
  const pages = await readPdfLines(file, report);
  if (pages.every(page => page.length === 0)) throw new Error("No selectable text found. Run OCR PDF first.");
  const rows = pages.map(rowsOf);
  if (format === "word") {
    const { Document, Paragraph, Packer } = await import("docx");
    const doc = new Document({ sections: rows.map(lines => ({
      children: lines.length ? lines.map(line => new Paragraph({ text: rowText(line), spacing: { after: 45 } })) : [new Paragraph("")],
    })) });
    return await Packer.toBlob(doc);
  }
  if (format === "excel") {
    const { default: writeXlsxFile } = await import("write-excel-file/universal");
    const sheets = rows.map((lines, index) => {
      const cells = lines.map(tableCells);
      const stops: number[] = [];
      for (const token of cells.flat().sort((a, b) => a.x - b.x)) {
        const previous = stops.at(-1);
        if (previous === undefined || token.x - previous > 9) stops.push(token.x);
      }
      const data = cells.map(values => {
        const row: Array<{ value: string } | null> = Array.from({ length: stops.length }, () => null);
        for (const token of values) {
          const found = stops.findIndex(x => Math.abs(x - token.x) <= 9);
          const previous = row[found]?.value;
          row[found] = { value: previous ? previous + " " + token.text : token.text };
        }
        return row;
      });
      return { sheet: "Page " + (index + 1), data, columns: stops.map(() => ({ width: 24 })) };
    });
    return await writeXlsxFile(sheets).toBlob();
  }
  const markdown = rows.map((lines, index) => {
    const sizes = lines.flat().map(item => item.size).sort((a, b) => a - b);
    const typical = sizes[Math.floor(sizes.length * 0.5)] ?? 0;
    const text = lines.map(line => {
      const content = rowText(line).replace(/[\\\x60*_#[\]<>|]/g, "\\$&");
      if (typical && Math.max(...line.map(item => item.size)) > typical * 1.26 && content.length < 120) return "### " + content;
      return content;
    }).join("\n\n");
    return "## Page " + (index + 1) + "\n\n" + text;
  }).join("\n\n---\n\n");
  return new Blob([markdown], { type: "text/markdown;charset=utf-8" });
}
