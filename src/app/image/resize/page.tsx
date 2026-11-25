"use client";

import { useState } from "react";
import { Download, Image as ImageIcon, X } from "lucide-react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { downloadAsZip, downloadFile } from "@/lib/download-manager";

type Size = { width: number; height: number };
type Source = Size & { id: string; file: File };
type Output = Size & { name: string; blob: Blob };
type Mode = "fit" | "exact" | "scale";

const modes = [
  { value: "fit", label: "Fit within", hint: "Each image keeps its own proportions and fits inside the width and height you enter." },
  { value: "exact", label: "Exact size", hint: "Every image uses these exact dimensions. This can stretch the image." },
  { value: "scale", label: "Scale (%)", hint: "Resize each image by the same percentage of its original size." },
] as const;

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const maxPixels = 32_000_000;

async function decode(file: File) {
  const image = new window.Image();
  const url = URL.createObjectURL(file);
  try {
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function resize(source: Source, size: Size, outputType: string) {
  const image = await decode(source.file);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  const type = outputType || (extensions[source.file.type] ? source.file.type : "image/png");
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size.width, size.height);
  }
  ctx.drawImage(image, 0, 0, size.width, size.height);
  try {
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image encoding failed")), type, 0.92);
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export default function ResizeImagePage() {
  const [images, setImages] = useState<Source[]>([]);
  const [outputs, setOutputs] = useState<Record<string, Output>>({});
  const [mode, setMode] = useState<Mode>("fit");
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");
  const [percent, setPercent] = useState("50");
  const [outputType, setOutputType] = useState("");
  const [status, setStatus] = useState<"idle" | "reading" | "resizing" | "zip">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const busy = status !== "idle";

  function target(source: Size): Size | null {
    if (mode === "scale") {
      const value = Number(percent);
      if (!Number.isFinite(value) || value <= 0 || value > 500) return null;
      return { width: Math.max(1, Math.round(source.width * value / 100)), height: Math.max(1, Math.round(source.height * value / 100)) };
    }
    const w = Number(width);
    const h = Number(height);
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return null;
    if (mode === "exact") return { width: w, height: h };
    const ratio = Math.min(w / source.width, h / source.height);
    return { width: Math.max(1, Math.round(source.width * ratio)), height: Math.max(1, Math.round(source.height * ratio)) };
  }

  async function addImages(files: File[]) {
    setStatus("reading");
    setError("");
    try {
      const added: Source[] = [];
      const failed: string[] = [];
      for (const file of files) {
        try {
          const image = await decode(file);
          added.push({ id: crypto.randomUUID(), file, width: image.naturalWidth, height: image.naturalHeight });
        } catch {
          failed.push(file.name);
        }
      }
      setImages(current => [...current, ...added]);
      if (failed.length) setError("Could not open: " + failed.join(", ") + ". Choose an image supported by your browser.");
    } finally {
      setStatus("idle");
    }
  }

  async function runResize() {
    if (busy || !images.length) return;
    const jobs = images.map(source => ({ source, size: target(source) }));
    if (jobs.some(({ size }) => !size || size.width > 16_384 || size.height > 16_384 || size.width * size.height > maxPixels)) {
      setError("Enter positive dimensions or a scale up to 500%. Each output must be at most 16,384 pixels per side and 32 megapixels.");
      return;
    }
    setStatus("resizing");
    setProgress(0);
    setError("");
    const finished: Record<string, Output> = {};
    const names = new Set<string>();
    const failed: string[] = [];
    try {
      for (const [index, { source, size }] of jobs.entries()) {
        if (!size) continue;
        try {
          const blob = await resize(source, size, outputType);
          const ext = extensions[blob.type] || "png";
          const stem = source.file.name.replace(/\.[^.]+$/, "") + "_resized";
          let name = stem + "." + ext;
          for (let suffix = 2; names.has(name.toLowerCase()); suffix++) name = stem + "_" + suffix + "." + ext;
          names.add(name.toLowerCase());
          finished[source.id] = { ...size, name, blob };
        } catch {
          failed.push(source.file.name);
        }
        setProgress(Math.round((index + 1) / jobs.length * 100));
      }
      setOutputs(finished);
      if (failed.length) setError("Could not resize: " + failed.join(", ") + ".");
    } finally {
      setStatus("idle");
    }
  }

  function removeImage(id: string) {
    setImages(current => current.filter(image => image.id !== id));
    setOutputs(current => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  const results = Object.values(outputs);
  async function downloadZip() {
    setStatus("zip");
    setError("");
    try {
      await downloadAsZip(results, "resized_images.zip");
    } catch {
      setError("Could not create the ZIP. You can still download each image separately.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <ToolWorkspace category="Image tools" backHref="/image" title="Resize Images" description="Resize one image or a batch and choose how the new dimensions are applied.">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <ToolPanel title="Images" description="Add images to compare their original and target sizes."
          action={images.length > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setImages([]); setOutputs({}); setError(""); }}>Clear list</Button>}>
          <FilePicker multiple accept="image/*" action={images.length ? "Add images" : "Choose images"}
            hint="Or drop one or more images here." disabled={busy} onFiles={addImages} />
          {status === "reading" && <p role="status" className="mt-3 text-sm text-muted-foreground">Reading images…</p>}
          {images.length > 0 && (
            <ul className="mt-4 space-y-2">
              {images.map(image => {
                const preview = target(image);
                const output = outputs[image.id];
                return (
                  <li key={image.id} className="flex items-center gap-2 rounded-lg border bg-background p-2 sm:p-3">
                    <ImageIcon aria-hidden="true" className="hidden size-5 shrink-0 text-primary sm:block" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" title={image.file.name}>{image.file.name}</p>
                      <p className="text-sm text-muted-foreground">{image.width} × {image.height}{preview && <> → {preview.width} × {preview.height}</>} px</p>
                      {output && <p className="text-sm text-muted-foreground">Last output: {output.width} × {output.height} px</p>}
                    </div>
                    {output && <Button variant="outline" size="icon" aria-label={"Download " + output.name} disabled={busy} onClick={() => downloadFile(output.blob, output.name)}><Download /></Button>}
                    <Button variant="ghost" size="icon" aria-label={"Remove " + image.file.name} disabled={busy} onClick={() => removeImage(image.id)}><X /></Button>
                  </li>
                );
              })}
            </ul>
          )}
        </ToolPanel>

        <ToolPanel title="Resize settings">
          <fieldset disabled={busy} className="space-y-4">
            <legend className="mb-2 text-sm font-medium">Sizing mode</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-accent p-1">
              {modes.map(option => (
                <label key={option.value} className="cursor-pointer rounded-md px-1 py-2 text-center text-sm font-medium has-checked:bg-card has-checked:shadow-xs has-focus-visible:outline-2">
                  <input type="radio" name="resize-mode" className="sr-only" value={option.value} checked={mode === option.value} onChange={() => setMode(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{modes.find(option => option.value === mode)?.hint}</p>
            {mode === "scale" ? (
              <label className="block text-sm font-medium">Scale (%)
                <Input className="mt-2" type="number" min="1" max="500" value={percent} onChange={event => setPercent(event.target.value)} />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">Width (px)
                  <Input className="mt-2" type="number" min="1" value={width} onChange={event => setWidth(event.target.value)} />
                </label>
                <label className="block text-sm font-medium">Height (px)
                  <Input className="mt-2" type="number" min="1" value={height} onChange={event => setHeight(event.target.value)} />
                </label>
              </div>
            )}
            <label className="block text-sm font-medium">Output format
              <select className="mt-2 block h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2" value={outputType}
                onChange={event => setOutputType(event.target.value)}>
                <option value="">Use source format when supported</option>
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </label>
          </fieldset>
          <Button size="lg" className="mt-5 w-full" disabled={busy || !images.length} onClick={runResize}>
            {status === "resizing" ? "Resizing…" : "Resize images"}
          </Button>
          {results.length > 1 && <Button variant="outline" className="mt-2 w-full" disabled={busy} onClick={downloadZip}><Download /> {status === "zip" ? "Preparing ZIP…" : "Download ZIP"}</Button>}
          {status === "resizing" && <Progress aria-label="Resize progress" className="mt-4" value={progress} />}
          {error && <p role="alert" className="mt-3 wrap-anywhere text-sm text-destructive">{error}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
