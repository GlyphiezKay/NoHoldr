"use client";

import { PdfPagePicker } from "@/components/pdf/pdf-page-picker";
import { ToolFile } from "@/components/layout/tool-file";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runPdfEngine } from "@/lib/pdf-engine";
import { extractPdf } from "@/lib/pdf-pages";
import { formatBytes } from "@/lib/download-manager";

export default function PdfWorkflow() {
  const [file, setFile] = useState<File | null>(null);
  const output = useToolExport(file);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState("");
  const [compress, setCompress] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (!file || busy) return;
    if (password && (!password.trim() || new TextEncoder().encode(password).length > 127)) {
      setError("Enter a non-blank password of up to 127 UTF-8 bytes, or leave it empty.");
      return;
    }
    setBusy(true);
    setError("");
    const name = file.name.replace(/\.pdf$/i, "") + "_processed.pdf";
    try {
      let current = file;
      if (pages.trim()) {
        setStatus("Extracting selected pages…");
        current = new File([await extractPdf(current, pages)], name, { type: "application/pdf" });
      }
      if (compress) {
        setStatus("Optimizing PDF structure…");
        const result = await runPdfEngine(current, "optimize");
        if (result.blob.size < current.size) current = new File([result.blob], name, { type: "application/pdf" });
      }
      if (password) {
        setStatus("Encrypting the result…");
        const result = await runPdfEngine(current, "protect", password);
        current = new File([result.blob], name, { type: "application/pdf" });
      }
      output.save(current, name);
      setPassword("");
      setStatus("Download ready · " + formatBytes(current.size));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete the workflow.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title="PDF Workflow" description="Run several operations in one pass. The tool writes a separate copy.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ToolPanel stage="input" title="Source PDF">
          {file && <div className="mb-3"><ToolFile blob={file} name={file.name} /></div>}
          <FilePicker accept=".pdf,application/pdf" action={file ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy} onFiles={async files => {
            if (files.length !== 1) { setError("Choose one PDF."); return; }
            setBusy(true); setError(""); setStatus("");
            setFile(files[0]); setPageCount(0); setPages("");
            try {
              const pdf = await PDFDocument.load(await files[0].arrayBuffer(), { updateMetadata: false });
              setPageCount(pdf.getPageCount());
            } catch {
              // Whole-file operations and typed selection use their own PDF readers.
            } finally {
              setBusy(false);
            }
          }} />
        </ToolPanel>
        <ToolPanel stage="settings" title="Workflow steps" description="Extract pages first, compress the result, then apply AES-256 protection last.">
          <fieldset disabled={busy} className="space-y-4">
            <PdfPagePicker file={file} total={pageCount} value={pages} onChange={setPages}
              label="Pages to extract (optional)" placeholder="All pages" initialMode="type" disabled={busy} />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="accent-primary" checked={compress} onChange={event => setCompress(event.target.checked)} />
              Compress without rasterizing pages
            </label>
            <label className="block text-sm font-medium">New password (optional)
              <Input className="mt-1" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} />
            </label>
          </fieldset>
          <Button className="mt-4 w-full" disabled={!file || busy || (!pages.trim() && !compress && !password)} onClick={run}>Run and download</Button>
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
        <ToolOutput file={output.file} />
      </div>
    </ToolWorkspace>
  );
}