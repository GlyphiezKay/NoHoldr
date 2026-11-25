"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Download, FileText, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/download-manager";
import { downloadPdfBytes } from "@/lib/pdf-utils";

interface UploadedFile {
  id: string;
  file: File;
  pageCount: number;
}

export default function MergePDFPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [filename, setFilename] = useState("merged.pdf");
  const [isReading, setIsReading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = isReading || isMerging;
  const totalPages = files.reduce((total, item) => total + item.pageCount, 0);

  async function addFiles(selected: File[]) {
    setIsReading(true);
    setError("");
    setMessage("");
    try {
      const accepted: UploadedFile[] = [];
      const rejected: string[] = [];
      for (const file of selected) {
        try {
          const pdf = await PDFDocument.load(await file.arrayBuffer());
          const pageCount = pdf.getPageCount();
          if (!pageCount) throw new Error("Empty PDF");
          accepted.push({ id: crypto.randomUUID(), file, pageCount });
        } catch {
          rejected.push(file.name);
        }
      }
      setFiles(current => [...current, ...accepted]);
      if (rejected.length) setError(`Could not open: ${rejected.join(", ")}. Choose readable PDFs without passwords.`);
    } finally {
      setIsReading(false);
    }
  }

  function moveFile(index: number, by: number) {
    setMessage("");
    setFiles(current => {
      const next = [...current];
      const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function merge() {
    if (busy || files.length < 2) return;
    const stem = filename.trim().replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*]/g, "_").trim();
    const outputName = `${stem || "merged"}.pdf`;
    setError("");
    setMessage("");
    setProgress(0);
    setIsMerging(true);
    try {
      const merged = await PDFDocument.create();
      for (const [index, { file }] of files.entries()) {
        const pdf = await PDFDocument.load(await file.arrayBuffer());
        const pages = await merged.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => merged.addPage(page));
        setProgress(Math.round((index + 1) / files.length * 90));
      }
      downloadPdfBytes(await merged.save(), outputName);
      setMessage(`Downloaded ${outputName} with ${totalPages} pages.`);
    } catch {
      setError("Could not merge these files. Try removing the problem PDF and running the merge again.");
    } finally {
      setIsMerging(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title="Merge PDF" description="Combine PDFs in the order you choose.">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <ToolPanel title="PDF files" description="Add at least two PDFs. The file at the top becomes the start of the merged document."
          action={files.length > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setFiles([]); setMessage(""); setError(""); }}>Clear list</Button>}>
          <FilePicker multiple accept=".pdf,application/pdf" action={files.length ? "Add PDFs" : "Choose PDFs"}
            hint="Or drop PDF files here." disabled={busy} onFiles={addFiles} />
          {isReading && <p role="status" className="mt-3 text-sm text-muted-foreground">Reading PDFs…</p>}
          {files.length > 0 && (
            <ol className="mt-4 space-y-2">
              {files.map(({ id, file, pageCount }, index) => (
                <li key={id} className="flex items-center gap-2 rounded-lg border bg-background px-2 py-2 sm:px-3">
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{index + 1}.</span>
                  <FileText aria-hidden="true" className="hidden size-4 shrink-0 text-primary sm:block" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" title={file.name}>{file.name}</p>
                    <p className="text-sm text-muted-foreground">{pageCount} {pageCount === 1 ? "page" : "pages"} · {formatBytes(file.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${file.name} up`} disabled={busy || index === 0} onClick={() => moveFile(index, -1)}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${file.name} down`} disabled={busy || index === files.length - 1} onClick={() => moveFile(index, 1)}><ArrowDown /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} disabled={busy}
                    onClick={() => { setFiles(current => current.filter(item => item.id !== id)); setMessage(""); }}><X /></Button>
                </li>
              ))}
            </ol>
          )}
        </ToolPanel>
        <ToolPanel title="Output" description={`${files.length} ${files.length === 1 ? "file" : "files"} · ${totalPages} ${totalPages === 1 ? "page" : "pages"}`}>
          <label htmlFor="merge-name" className="mb-2 block text-sm font-medium">File name</label>
          <Input id="merge-name" value={filename} onChange={event => setFilename(event.target.value)} disabled={busy} maxLength={180} />
          <Button className="mt-4 w-full" size="lg" disabled={busy || files.length < 2} onClick={merge}>
            <Download /> {isMerging ? "Merging PDFs…" : "Merge & Download"}
          </Button>
          {isMerging && <Progress aria-label="Merge progress" value={progress} className="mt-4" />}
          {message && <p role="status" className="mt-3 wrap-anywhere text-sm text-muted-foreground">{message}</p>}
          {error && <p role="alert" className="mt-3 wrap-anywhere text-sm text-destructive">{error}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
