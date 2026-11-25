"use client";

import { useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { ToolFile } from "@/components/layout/tool-file";
import { EmptyOutput, ViewToolResult } from "@/components/layout/tool-output";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { findCompressionTarget } from "@/lib/compression-target";
import { downloadAsZip, downloadFile } from "@/lib/download-manager";
import { exportCanvas, imageFormats, imageOutputName, makeImageCanvas, opaqueFormat, openLocalImage, uniqueImageName, type ImageFormat } from "@/lib/image-processing";

const modes = {
  compress: { title: "Compress Images", description: "Reduce size in batches. Set a quality or let NoHoldr search for the closest result below a KB limit.", action: "Compress images", suffix: "_compressed" },
  convert: { title: "Convert Images", description: "Batch-convert images to another format with optional width limits. Animated inputs are exported as a single frame.", action: "Convert images", suffix: "" },
  rotate: { title: "Rotate and Flip Images", description: "Apply the same rotation or mirror settings to multiple images.", action: "Transform images", suffix: "_rotated" },
  upscale: { title: "Upscale Images", description: "Enlarge images with high-quality resampling. Output size increases, but original detail is unchanged.", action: "Upscale images", suffix: "_upscaled" },
  clean: { title: "Remove Image Metadata", description: "Re-encode visible pixels into a new image to remove source EXIF, GPS, and other original metadata. Animated images become stills.", action: "Remove metadata", suffix: "_clean" },
} as const;

export type ImageBatchMode = keyof typeof modes;
type Settings = { format: ImageFormat; quality: number; target: number; maxWidth: number; angle: number; flipX: boolean; flipY: boolean; factor: number; matte: string; iconSize: number };
type Item = { id: string; file: File; output?: { blob: Blob; name: string; detail: string }; error?: string };

async function processImage(file: File, mode: ImageBatchMode, settings: Settings) {
  const image = await openLocalImage(file);
  const { naturalWidth: width, naturalHeight: height } = image;
  const adjusted = mode === "upscale" ? settings.factor : settings.maxWidth ? Math.min(1, settings.maxWidth / width) : 1;
  const rotateSides = settings.angle === 90 || settings.angle === 270;

  async function render(scale: number, quality: number) {
    const w = Math.max(1, Math.round(width * adjusted * scale));
    const h = Math.max(1, Math.round(height * adjusted * scale));
    const outputW = settings.format === "ico" ? settings.iconSize : rotateSides ? h : w;
    const outputH = settings.format === "ico" ? settings.iconSize : rotateSides ? w : h;
    const { canvas, context } = makeImageCanvas(outputW, outputH);
    try {
      if (opaqueFormat(settings.format)) {
        context.fillStyle = settings.matte;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (settings.format === "ico") {
        const fit = Math.min(outputW / width, outputH / height);
        const drawW = width * fit, drawH = height * fit;
        context.drawImage(image, (outputW - drawW) / 2, (outputH - drawH) / 2, drawW, drawH);
      } else {
        context.translate(outputW / 2, outputH / 2);
        context.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
        context.rotate(settings.angle * Math.PI / 180);
        context.drawImage(image, -w / 2, -h / 2, w, h);
      }
      return { blob: await exportCanvas(canvas, settings.format, quality), width: outputW, height: outputH };
    } finally {
      canvas.width = canvas.height = 0;
    }
  }

  const original = { blob: file, width, height, size: file.size };
  if (mode === "compress" && settings.target) {
    const capped = adjusted < 1 ? await render(1, 0.96) : undefined;
    const baseline = capped ? { ...capped, size: capped.blob.size } : original;
    const result = await findCompressionTarget(baseline, settings.target, async quality => {
      const encoded = await render(0.13 + 0.87 * quality, 0.16 + 0.8 * quality);
      return { ...encoded, size: encoded.blob.size };
    });
    return { ...result, keep: result.blob === file };
  }
  const result = await render(1, settings.quality);
  if (mode === "compress" && adjusted === 1 && result.blob.size >= file.size) return { ...original, keep: true };
  return { ...result, keep: false };
}

export function ImageBatchTool({ mode, fromConvert = false }: { mode: ImageBatchMode; fromConvert?: boolean }) {
  const info = modes[mode];
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<ImageFormat>(mode === "compress" || mode === "convert" ? "webp" : "png");
  const [quality, setQuality] = useState("82");
  const [limit, setLimit] = useState("");
  const [target, setTarget] = useState("");
  const [factor, setFactor] = useState("2");
  const [angle, setAngle] = useState(90);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [matte, setMatte] = useState("#ffffff");
  const [iconSize, setIconSize] = useState(64);
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [problem, setProblem] = useState("");
  const stopped = useRef(false);
  const locked = busy || zipping;
  const output = items.flatMap(item => item.output ? [item.output] : []);
  const formats: ImageFormat[] = mode === "convert"
    ? ["jpeg", "png", "webp", "avif", "bmp", "gif", "svg", "ico"] : mode === "compress"
      ? ["webp", "jpeg", "avif"] : ["png", "jpeg", "webp"];

  function add(files: File[]) {
    const incoming = files.map(file => ({ id: crypto.randomUUID(), file }));
    setItems(current => [...current, ...incoming]);
    setProblem("");
  }

  async function run() {
    if (!items.length || locked) return;
    const maxWidth = limit ? Number(limit) : 0;
    if ((limit && (!Number.isInteger(maxWidth) || maxWidth < 1 || maxWidth > 16384)) ||
      (target && (!Number.isSafeInteger(Number(target)) || Number(target) < 1 || Number(target) > 204800)) ||
      !quality || Number(quality) < 1 || Number(quality) > 100) {
      setProblem("Enter a valid width, quality, or target size.");
      return;
    }

    const settings = { format, target: Number(target) * 1024, quality: Number(quality) / 100, maxWidth,
      angle: mode === "rotate" ? angle : 0, flipX, flipY, factor: Number(factor), matte, iconSize };
    stopped.current = false;
    setBusy(true);
    setProgress(0);
    setProblem("");
    const completed = items.map(item => ({ id: item.id, file: item.file }) as Item);
    const used = new Set<string>();
    let succeeded = 0;
    let failed = 0;
    try {
      for (const [index, item] of completed.entries()) {
        if (stopped.current) break;
        setStatus("Processing image " + (index + 1) + " of " + completed.length + "…");
        try {
          const result = await processImage(item.file, mode, settings);
          const name = result.keep ? item.file.name : imageOutputName(item.file, info.suffix, format);
          const parts = [result.width + " × " + result.height + " px"];
          if (result.keep) parts.push("Original kept");
          else if (mode === "compress") parts.push(Math.round((1 - result.blob.size / item.file.size) * 100) + "% smaller");
          if (settings.target) parts.push(result.blob.size <= settings.target ? "Target met" : "Target not reached");
          item.output = { blob: result.blob, name: uniqueImageName(name, used), detail: parts.join(" · ") };
          succeeded++;
        } catch (reason) {
          item.error = reason instanceof Error ? reason.message : "Could not process this image.";
          failed++;
        }
        setProgress(Math.round((index + 1) / completed.length * 100));
      }
      setItems(completed);
      setStatus((stopped.current ? "Stopped · " : "") + succeeded + " ready" + (failed ? " · " + failed + " failed" : ""));
    } finally {
      setBusy(false);
    }
  }

  async function zip() {
    setZipping(true);
    try {
      await downloadAsZip(output, "noholdr" + (info.suffix || "_converted") + ".zip");
    } catch {
      setProblem("Could not build the ZIP. Download the images individually.");
    } finally {
      setZipping(false);
    }
  }

  return (
    <ToolWorkspace tone="image" category={fromConvert ? "Convert" : "Image tools"} backHref={fromConvert ? "/convert" : "/image"} title={info.title} description={info.description}>
      <div className="studio-flow">
        <ToolPanel stage="input" title="Source images" action={items.length > 0 && <Button variant="ghost" size="sm" disabled={locked} onClick={() => { setItems([]); setStatus(""); }}>Clear list</Button>}>
          <FilePicker multiple accept="image/*,.heic,.heif,.tiff" action={items.length ? "Add images" : "Choose images"} hint="Or drop image files here." disabled={locked} onFiles={add} />
          {items.length > 0 && <ul className="mt-4 space-y-2">
            {items.map(item => <li key={item.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <ToolFile blob={item.file} name={item.file.name} />
                {item.error && <p className="mt-1 text-sm text-destructive">{item.error}</p>}
              </div>
              <Button variant="ghost" size="icon" aria-label={"Remove " + item.file.name} disabled={locked} onClick={() => setItems(current => current.filter(other => other.id !== item.id))}><X /></Button>
            </li>)}
          </ul>}
        </ToolPanel>
        <ToolPanel stage="settings" title="Output settings">
          <fieldset disabled={locked} className="space-y-3">
            <label className="block text-sm font-medium">Format<select aria-label="Format" className="mt-2 block h-10 w-full rounded border bg-background px-3" value={format} onChange={event => setFormat(event.target.value as ImageFormat)}>
              {formats.map(value => <option key={value} value={value}>{imageFormats[value].label}</option>)}
            </select></label>
            {(format === "jpeg" || format === "webp" || format === "avif") && <label className="block text-sm font-medium">Quality (%)
              <Input className="mt-2" type="number" min="1" max="100" disabled={mode === "compress" && Boolean(target)} value={quality} onChange={event => setQuality(event.target.value)} />
            </label>}
            {opaqueFormat(format) && <label className="flex items-center gap-2 text-sm font-medium">Background for transparent pixels <input type="color" value={matte} onChange={event => setMatte(event.target.value)} /></label>}
            {mode === "compress" && <label className="block text-sm font-medium">Target size per image (KB, optional)
              <Input className="mt-2" type="number" min="1" max="204800" placeholder="e.g. 300" value={target} onChange={event => setTarget(event.target.value)} />
              <span className="mt-1 block text-sm font-normal text-muted-foreground">NoHoldr adjusts quality and dimensions to reach the cap. It keeps the original if that is already smaller.</span>
            </label>}
            {(mode === "compress" || mode === "convert") && format !== "ico" && <label className="block text-sm font-medium">Maximum width (px, optional)
              <Input className="mt-2" type="number" min="1" max="16384" placeholder="Original width" value={limit} onChange={event => setLimit(event.target.value)} />
            </label>}
            {format === "ico" && <label className="block text-sm font-medium">Icon size<select className="mt-2 h-10 w-full rounded border bg-background px-3" value={iconSize} onChange={event => setIconSize(Number(event.target.value))}>
              {[16, 32, 48, 64, 128, 256].map(size => <option key={size} value={size}>{size} × {size}</option>)}
            </select></label>}
            {mode === "rotate" && <>
              <label className="block text-sm font-medium">Rotation<select className="mt-2 h-10 w-full rounded border bg-background px-3" value={angle} onChange={event => setAngle(Number(event.target.value))}>
                {[0, 90, 180, 270].map(n => <option key={n} value={n}>{n}° clockwise</option>)}
              </select></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={flipX} onChange={event => setFlipX(event.target.checked)} />Mirror horizontally</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={flipY} onChange={event => setFlipY(event.target.checked)} />Mirror vertically</label>
            </>}
            {mode === "upscale" && <label className="block text-sm font-medium">Scale<select className="mt-2 h-10 w-full rounded border bg-background px-3" value={factor} onChange={event => setFactor(event.target.value)}>
              <option value="1.5">1.5×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option>
            </select></label>}
          </fieldset>
          <Button className="mt-4 w-full" size="lg" disabled={!items.length || locked} onClick={run}>{info.action}</Button>
          {busy && <div className="mt-3 space-y-2"><Progress value={progress} aria-label="Batch progress" />
            <Button variant="outline" size="sm" onClick={() => { stopped.current = true; }}>Stop after this image</Button></div>}
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {problem && <p role="alert" className="mt-3 text-sm text-destructive">{problem}</p>}
          {output.length > 0 && !busy && <ViewToolResult />}
        </ToolPanel>
        <ToolPanel stage="result" title="Results">
          {output.length ? <ul className="grid gap-2 lg:grid-cols-2">
            {output.map((file, index) => <li key={index} className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1"><ToolFile blob={file.blob} name={file.name} detail={file.detail} /></div>
              <Button variant="outline" size="icon" aria-label={"Download " + file.name} disabled={locked} onClick={() => downloadFile(file.blob, file.name)}><Download /></Button>
            </li>)}
          </ul> : <EmptyOutput />}
          {output.length > 1 && <Button className="mt-3" variant="outline" disabled={locked} onClick={zip}><Download /> {zipping ? "Preparing ZIP…" : "Download ZIP"}</Button>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
