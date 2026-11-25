"use client";

import { useState } from "react";
import { Copy, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { ToolFile } from "@/components/layout/tool-file";
import { EmptyOutput } from "@/components/layout/tool-output";
import { AI_IMAGE_ACCEPT, AI_IMAGE_HINT, generateImageMetadata, hasApiKey, getErrorMessage, validAiImage, type ImageMetadata } from "@/lib/gemini";
import { jsonToCSV } from "@/lib/csv-utils";
import { downloadFile } from "@/lib/download-manager";

type Item = { id: string; file: File; metadata?: ImageMetadata; error?: string };

export default function GenerateMetadataPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const results = items.flatMap(item => item.metadata ? [{ id: item.id, file: item.file, ...item.metadata }] : []);

  function add(files: File[]) {
    const valid = files.filter(validAiImage);
    setItems(current => [...current, ...valid.map(file => ({ id: crypto.randomUUID(), file }))]);
    setError(valid.length < files.length ? "Some files were skipped. " + AI_IMAGE_HINT : "");
    setStatus("");
  }

  async function run() {
    if (busy || !items.length) return;
    if (!hasApiKey()) { setError("Add your Gemini API key in AI tools first."); return; }
    setError("");
    setBusy(true);
    const pending = items.filter(item => !item.metadata);
    try {
      for (const [index, item] of pending.entries()) {
        setStatus(`Processing image ${index + 1} of ${pending.length}…`);
        let changed: Item;
        try { changed = { ...item, metadata: await generateImageMetadata(item.file), error: undefined }; }
        catch (reason) { changed = { ...item, error: getErrorMessage(reason) }; }
        setItems(current => current.map(value => value.id === item.id ? changed : value));
      }
    } finally {
      setStatus("");
      setBusy(false);
    }
  }

  function exportCSV() {
    const csv = jsonToCSV(results.map(item => ({
      filename: item.file.name, title: item.title, description: item.description, keywords: item.keywords.join(", "),
    })));
    downloadFile(new Blob([csv], { type: "text/csv;charset=utf-8" }), "metadata.csv");
  }

  return (
    <ToolWorkspace category="AI tools" backHref="/ai" title="Generate Metadata" description="Generate titles, descriptions, and keywords for selected images." thumbnails>
      <div className="grid gap-5">
        <ToolPanel stage="input" title="Source images">
          <FilePicker accept={AI_IMAGE_ACCEPT} multiple disabled={busy} action={items.length ? "Add images" : "Choose images"} hint={AI_IMAGE_HINT} onFiles={add} />
          {!!items.length && <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map(item => <li className="flex items-center gap-2" key={item.id}>
              <div className="min-w-0 flex-1">
                <ToolFile blob={item.file} name={item.file.name} detail={item.metadata ? "Metadata ready" : undefined} />
                {item.error && <p role="alert" className="mt-1 text-sm text-destructive">{item.error}</p>}
              </div>
              <Button variant="ghost" size="icon" aria-label={"Remove " + item.file.name} disabled={busy}
                onClick={() => setItems(current => current.filter(value => value.id !== item.id))}><X /></Button>
            </li>)}
          </ul>}
          <Button onClick={run} className="mt-3" disabled={busy || items.length === results.length}>{busy ? "Processing…" : "Generate Metadata"}</Button>
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
        <ToolPanel stage="result" title="Image metadata" action={results.length > 0 && <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => {
            try {
              await navigator.clipboard.writeText(results.map(item => [item.file.name, item.title, item.description, item.keywords.join(", ")].join("\n")).join("\n\n"));
              setStatus("Metadata copied.");
            } catch { setError("Could not access the clipboard."); }
          }}><Copy />Copy</Button>
          <Button variant="outline" onClick={exportCSV}><Download />Download CSV</Button>
        </div>}>
          {results.length ? <ul className="grid gap-3 sm:grid-cols-2">
            {results.map(item => <li key={item.id} className="rounded-xl border bg-background p-3">
              <p className="wrap-anywhere text-xs text-muted-foreground">{item.file.name}</p>
              <h3 className="mt-1 wrap-anywhere font-medium">{item.title}</h3>
              <p className="mt-1 wrap-anywhere text-sm">{item.description}</p>
              <p className="mt-2 wrap-anywhere text-sm text-muted-foreground">{item.keywords.join(", ")}</p>
            </li>)}
          </ul> : <EmptyOutput>Generated metadata will appear here.</EmptyOutput>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
