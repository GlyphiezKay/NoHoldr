"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/download-manager";
import { extractPdf } from "@/lib/pdf-pages";

export default function ExtractPages() {
  const [source, setSource] = useState<{ file: File; pages: number } | null>(null);
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
      downloadFile(await extractPdf(source.file, selection), source.file.name.replace(/\.pdf$/i, "") + "_extracted.pdf");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not extract the selected pages.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title="Extract PDF pages" description="Build a new PDF from the pages you choose, in the order you list them.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ToolPanel title="Source PDF">
          {source && <p className="mb-3 break-all rounded-lg border bg-background p-3 text-sm">{source.file.name} · {source.pages} pages</p>}
          <FilePicker accept=".pdf,application/pdf" action={source ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy} onFiles={read} />
        </ToolPanel>
        <ToolPanel title="Select pages" description="Use commas or ranges such as 4, 1–3. Repeated pages are added only once.">
          <form onSubmit={event => { event.preventDefault(); void run(); }}>
            <label className="block text-sm font-medium">Pages
              <Input className="mt-2" placeholder="4, 1-3" value={selection} disabled={!source || busy}
                onChange={event => setSelection(event.target.value.replace(/[–—]/g, "-"))} />
            </label>
            <Button className="mt-4 w-full" disabled={!source || !selection.trim() || busy} type="submit">Extract and download</Button>
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}