"use client";

import { useState } from "react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadFile, formatBytes } from "@/lib/download-manager";
import { openLocalImage } from "@/lib/image-processing";

type Result = { file: File; width: number; height: number; metadata: Record<string, unknown>; metadataError: boolean };

export default function ImageMetadataPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function read(files: File[]) {
    if (files.length !== 1) { setError("Choose one image."); return; }
    const file = files[0];
    setBusy(true);
    setError("");
    try {
      const image = await openLocalImage(file);
      let metadata: Record<string, unknown> = {};
      let metadataError = false;
      try {
        const { parse } = await import("exifr");
        metadata = await parse(file, { tiff: true, exif: true, gps: true, xmp: true, iptc: true }) ?? {};
      } catch {
        metadataError = true;
      }
      setResult({ file, width: image.naturalWidth, height: image.naturalHeight, metadata, metadataError });
      setQuery("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open the image.");
    } finally {
      setBusy(false);
    }
  }

  const tags = result ? Object.entries(result.metadata).map(([key, value]) => {
    const text = value instanceof Date ? (Number.isFinite(value.getTime()) ? value.toISOString() : "Invalid date") : typeof value === "string" ? value : JSON.stringify(value) ?? "";
    return { key, text };
  }) : [];
  const filtered = tags.filter(({ key, text }) => (key + " " + text).toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <ToolWorkspace category="Image tools" backHref="/image" title="View Image Metadata" description="Inspect image dimensions and available EXIF, GPS, XMP, and IPTC tags.">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)]">
        <ToolPanel title="Source image">
          {result && <dl className="mb-3 space-y-1 rounded border bg-background p-3 text-sm">
            <div className="break-all font-semibold">{result.file.name}</div>
            <div><dt className="inline">Dimensions · </dt><dd className="inline">{result.width} × {result.height} px</dd></div>
            <div><dt className="inline">File size · </dt><dd className="inline">{formatBytes(result.file.size)}</dd></div>
          </dl>}
          <FilePicker accept="image/*" action={result ? "Replace image" : "Choose image"} hint="Or drop an image here." disabled={busy} onFiles={read} />
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          {busy && <p role="status" className="mt-3 text-sm text-muted-foreground">Reading image metadata…</p>}
        </ToolPanel>
        <ToolPanel title="Metadata tags">
          {!result && <p className="text-sm text-muted-foreground">Choose an image to inspect its tags.</p>}
          {result?.metadataError && <p className="text-sm text-muted-foreground">The metadata block could not be read for this format or file.</p>}
          {result && !result.metadataError && !tags.length && <p role="status" className="text-sm text-muted-foreground">No supported metadata tags found.</p>}
          {result && tags.length > 0 && <>
            <Input value={query} onChange={event => setQuery(event.target.value)} className="mb-4" type="search" aria-label="Find metadata" placeholder="Find a tag or value" />
            {filtered.length ? <dl className="divide-y">
              {filtered.map(({ key, text }) => <div key={key} className="grid gap-1 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <dt className="wrap-anywhere text-muted-foreground">{key}</dt><dd className="wrap-anywhere font-medium">{text}</dd>
              </div>)}
            </dl> : <p role="status" className="text-sm text-muted-foreground">No matching tags.</p>}
            <Button className="mt-4" variant="outline" onClick={() => {
              const data = JSON.stringify({ file: result.file.name, width: result.width, height: result.height, tags: result.metadata }, null, 2);
              downloadFile(new Blob([data], { type: "application/json" }), result.file.name + ".metadata.json");
            }}>Download metadata JSON</Button>
          </>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}