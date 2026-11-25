"use client";

import Link from "next/link";
import { useState } from "react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { downloadFile } from "@/lib/download-manager";
import { exportPdf, type ExportFormat } from "@/lib/pdf-export";

const formats = {
  markdown: { name: "PDF to Markdown", extension: "md", description: "Export selectable text and detected headings as Markdown. Complex layouts and scanned images need review." },
  word: { name: "PDF to Word", extension: "docx", description: "Export selectable text into an editable DOCX, with a section for each page. Original graphics and exact layout are omitted." },
  slides: { name: "PDF to PowerPoint", extension: "pptx", description: "Create a presentation with one rendered PDF page per slide. Page appearance is preserved as an image." },
  excel: { name: "PDF to Excel", extension: "xlsx", description: "Extract selectable text into cells by its position, with one sheet per PDF page. Review columns and values for complex tables." },
} as const;

export function PdfExportTool({ format }: { format: ExportFormat }) {
  const info = formats[format];
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setStatus("Opening PDF…");
    try {
      const blob = await exportPdf(file, format, (page, total) => setStatus("Processing page " + page + " of " + total + "…"));
      downloadFile(blob, file.name.replace(/\.pdf$/i, "") + "." + info.extension);
      setStatus("Download ready.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not export the PDF.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title={info.name} description={info.description}>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ToolPanel title="Source PDF">
          {file && <p className="mb-3 break-all rounded-lg border bg-background p-3 text-sm">{file.name}</p>}
          <FilePicker accept=".pdf,application/pdf" action={file ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy} onFiles={files => {
            if (files.length !== 1) { setError("Choose one PDF."); return; }
            setFile(files[0]); setError(""); setStatus("");
          }} />
        </ToolPanel>
        <ToolPanel title="Export">
          {format !== "slides" && <p className="mb-4 text-sm text-muted-foreground">For scanned documents, first make a searchable copy with <Link href="/pdf/ocr" className="underline underline-offset-2">OCR PDF</Link>.</p>}
          <Button className="w-full" disabled={!file || busy} onClick={run}>Download {info.extension.toUpperCase()}</Button>
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}