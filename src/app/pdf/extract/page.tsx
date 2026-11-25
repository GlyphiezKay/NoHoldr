"use client";

import { PdfPagePicker } from "@/components/pdf/pdf-page-picker";
import { ToolFile } from "@/components/layout/tool-file";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { Button } from "@/components/ui/button";
import { extractPdf } from "@/lib/pdf-pages";

export default function ExtractPages() {
  const [source, setSource] = useState<{ file: File; pages: number } | null>(null);
  const output = useToolExport(source);
  const [selection, setSelection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function read(files: File[]) {
    if (files.length !== 1) { setError("Choose one PDF."); return; }
    setBusy(true);
    setError("");
    try {
      const doc = await PDFDocument.load(await files[0].arrayBuffer());
      setSource({ file: files[0], pages: doc.getPageCount() });
      setSelection("");
    } catch {
      setError("Could not open this PDF. Check the file and any password protection.");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!source || busy) return;
    setBusy(true);
    setError("");
    try {
      output.save(await extractPdf(source.file, selection), source.file.name.replace(/\.pdf$/i, "") + "_extracted.pdf");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not extract the selected pages.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title="Extract PDF pages" description="Build a new PDF. Pages appear in the order you choose.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ToolPanel stage="input" title="Source PDF">
          {source && <div className="mb-3"><ToolFile blob={source.file} name={source.file.name} detail={source.pages + " pages"} /></div>}
          <FilePicker accept=".pdf,application/pdf" action={source ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy} onFiles={read} />
        </ToolPanel>
        <ToolPanel stage="settings" title="Select pages" description="Use commas or ranges such as 4, 1–3. Repeated pages are added only once.">
          <form onSubmit={event => { event.preventDefault(); void run(); }}>
            <PdfPagePicker file={source?.file ?? null} total={source?.pages ?? 0} value={selection}
              onChange={setSelection} label="Pages" disabled={busy} />
            <Button className="mt-4 w-full" disabled={!source || !selection.trim() || busy} type="submit">Extract and download</Button>
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
        <ToolOutput file={output.file} />
      </div>
    </ToolWorkspace>
  );
}