"use client";

import { useState } from "react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runPdfEngine } from "@/lib/pdf-engine";
import { extractPdf } from "@/lib/pdf-pages";
import { downloadFile, formatBytes } from "@/lib/download-manager";

export default function PdfWorkflow() {
  const [file, setFile] = useState<File | null>(null);
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
      downloadFile(current, name);
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
        <ToolPanel title="Source PDF">
          {file && <p className="mb-3 break-all rounded-lg border bg-background p-3 text-sm">{file.name} · {formatBytes(file.size)}</p>}
          <FilePicker accept=".pdf,application/pdf" action={file ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy} onFiles={files => {
            if (files.length !== 1) { setError("Choose one PDF."); return; }
            setFile(files[0]); setError(""); setStatus("");
          }} />
        </ToolPanel>
        <ToolPanel title="Workflow steps" description="Extract pages first, compress the result, then apply AES-256 protection last.">
          <fieldset disabled={busy} className="space-y-4">
            <label className="block text-sm font-medium">Pages to extract (optional)
              <Input className="mt-1" placeholder="All pages" value={pages} onChange={event => setPages(event.target.value)} />
            </label>
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
      </div>
    </ToolWorkspace>
  );
}