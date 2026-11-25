"use client";

import { useState } from "react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { downloadFile, formatBytes } from "@/lib/download-manager";
import { officeExtensions, officeToPdf, type OfficeFormat } from "@/lib/office-pdf";

const formats = {
  word: { title: "Word to PDF", description: "Render a Word, OpenDocument, or RTF file as PDF." },
  excel: { title: "Excel to PDF", description: "Render workbook sheets as PDF using the document’s print settings." },
  powerpoint: { title: "PowerPoint to PDF", description: "Export presentation slides to PDF." },
  html: { title: "HTML to PDF", description: "Export a local HTML file. Embed its images and styles in the file for best results." },
  archive: { title: "PDF to PDF/A", description: "Create a flattened PDF/A-2b copy with embedded color information for archival use." },
};

export function OfficePdfTool({ format }: { format: OfficeFormat }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const extensions = officeExtensions[format];

  async function run() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setStatus("Preparing conversion…");
    try {
      const output = await officeToPdf(file, format, setStatus);
      downloadFile(output, file.name.replace(/\.[^.]+$/, "") + (format === "archive" ? "_pdfa.pdf" : ".pdf"));
      setStatus("Download ready.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not convert the document.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title={formats[format].title} description={formats[format].description}>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ToolPanel title="Source file">
          {file && <p className="mb-3 break-all rounded-lg border bg-background p-3 text-sm">{file.name} · {formatBytes(file.size)}</p>}
          <FilePicker accept={extensions.map(ext => "." + ext).join(",")} action={file ? "Replace file" : "Choose file"}
            hint={"Supported: " + extensions.map(ext => "." + ext).join(", ")} disabled={busy} onFiles={files => {
              if (files.length !== 1) { setError("Choose one file."); return; }
              setFile(files[0]); setError(""); setStatus("");
            }} />
        </ToolPanel>
        <ToolPanel title="Export PDF" description={format === "archive"
          ? "The exported pages are images. Selectable text, links, forms, and signatures are removed. Validate the output before archiving."
          : "The LibreOffice engine runs in a compatible desktop Chromium browser. The first run loads a large engine from this site."}>
          <Button className="w-full" size="lg" disabled={!file || busy} onClick={run}>{busy ? "Converting…" : "Convert and download"}</Button>
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
