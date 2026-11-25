"use client";

import { useState } from "react";
import JSZip, { type JSZipObject } from "jszip";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { EmptyOutput } from "@/components/layout/tool-output";
import { ToolFile } from "@/components/layout/tool-file";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { downloadFile } from "@/lib/download-manager";
import { fileStem, safeFileName } from "@/lib/file-utilities";

export default function ExtractZIPPage() {
  const [source, setSource] = useState<{ file: File; entries: JSZipObject[] }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function open(files: File[]) {
    setBusy(true);
    setError("");
    setSource(undefined);
    try {
      const file = files[0];
      const archive = await JSZip.loadAsync(file);
      setSource({ file, entries: Object.values(archive.files).filter(entry => !entry.dir) });
    } catch {
      setError("Could not open this ZIP. Check that it is a valid, unencrypted archive.");
    } finally {
      setBusy(false);
    }
  }

  async function save(entry: JSZipObject) {
    setBusy(true);
    setError("");
    try {
      downloadFile(await entry.async("blob"), safeFileName(entry.name.split("/").at(-1) || entry.name));
    } catch {
      setError("Could not extract " + entry.name + ".");
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    if (!source || busy) return;
    setBusy(true);
    setError("");
    try {
      const archive = new JSZip();
      for (const entry of source.entries) archive.file(entry.name, await entry.async("uint8array"));
      const blob = await archive.generateAsync({ type: "blob", compression: "DEFLATE" });
      downloadFile(blob, fileStem(source.file.name) + "_extracted.zip");
    } catch {
      setError("Could not extract every file. Try downloading individual entries.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="Files tools" backHref="/files" title="Extract ZIP" description="Inspect the archive before downloading individual files.">
      <div className="grid gap-5">
        <ToolPanel stage="input" title="Source archive">
          {source && <div className="mb-3"><ToolFile blob={source.file} name={source.file.name} detail={source.entries.length + " entries"} /></div>}
          <FilePicker accept=".zip,application/zip" disabled={busy} action={source ? "Replace ZIP" : "Choose ZIP"} hint="Or drop a ZIP archive here." onFiles={open} />
          {busy && <p role="status" className="mt-3 text-sm text-muted-foreground">Reading archive…</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
        <ToolPanel stage="result" title="Archive files" action={source && source.entries.length > 0 &&
          <Button variant="outline" onClick={saveAll} disabled={busy}><Download />Download all as ZIP</Button>}>
          {source?.entries.length ? <ul className="divide-y">
            {source.entries.map(entry => <li key={entry.name} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 wrap-anywhere text-sm font-medium">{entry.name}</span>
              <Button variant="outline" size="icon" aria-label={"Download " + entry.name} disabled={busy} onClick={() => save(entry)}><Download /></Button>
            </li>)}
          </ul> : <EmptyOutput>{source ? "The archive is empty." : "Choose an archive to see its files here."}</EmptyOutput>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
