"use client";

import { useRef, useState } from "react";
import { Check, Copy, Pipette } from "lucide-react";
import { ToolFile } from "@/components/layout/tool-file";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { useThumbnails } from "@/components/layout/thumbnail-preference";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { openLocalImage } from "@/lib/image-processing";

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(value => value.toString(16).padStart(2, "0")).join("");
}

function dominantColors(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const scale = Math.min(200 / image.naturalWidth, 200 / image.naturalHeight, 1);
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not sample image colors.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const frequencies = new Map<number, number>();
  const quantize = (value: number) => Math.min(255, Math.round(value / 24) * 24);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const key = (quantize(data[i]) << 16) | (quantize(data[i + 1]) << 8) | quantize(data[i + 2]);
    frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  }

  return [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([key, count]) => {
    const r = key >> 16, g = (key >> 8) & 255, b = key & 255;
    return { hex: rgbToHex(r, g, b), rgb: `rgb(${r}, ${g}, ${b})`, count, percent: Math.round(count * 100 / (canvas.width * canvas.height)) };
  });
}

export default function ColorExtractorPage() {
  const thumbnails = useThumbnails();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [palette, setPalette] = useState<ReturnType<typeof dominantColors>>([]);
  const [paletteSize, setPaletteSize] = useState(8);
  const [picked, setPicked] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const colors = palette.slice(0, paletteSize);

  async function choose(files: File[]) {
    if (files.length !== 1 || !canvas.current) return;
    setBusy(true);
    setError("");
    try {
      const image = await openLocalImage(files[0]);
      if (!canvas.current) return;
      setPalette(dominantColors(canvas.current, image));
      setFile(files[0]);
      setPicked("");
      setCopied("");
    } catch {
      setError("Could not open this image.");
    } finally {
      setBusy(false);
    }
  }

  function sample(event: React.MouseEvent<HTMLCanvasElement>) {
    const target = event.currentTarget;
    const bounds = target.getBoundingClientRect();
    const x = Math.min(target.width - 1, Math.floor((event.clientX - bounds.left) * target.width / bounds.width));
    const y = Math.min(target.height - 1, Math.floor((event.clientY - bounds.top) * target.height / bounds.height));
    const pixel = target.getContext("2d")?.getImageData(x, y, 1, 1).data;
    if (pixel) setPicked(rgbToHex(pixel[0], pixel[1], pixel[2]));
  }

  async function copy(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
    } catch {
      setError("Could not copy to the clipboard.");
    }
  }

  return (
    <ToolWorkspace tone="image" category="Data tools" backHref="/data" title="Image Color Extractor"
      description="Extract dominant colors from an image or pick a color directly from the preview.">
      <div className="studio-flow">
        <ToolPanel stage="input" title="Source image">
          {file && <div className="mb-3"><ToolFile blob={file} name={file.name} /></div>}
          <FilePicker accept="image/*" action={file ? "Replace image" : "Choose image"} hint="Or drop an image here." disabled={busy} onFiles={choose} />
          <canvas ref={canvas} hidden={!file || !thumbnails} onClick={sample} aria-label="Click to sample a pixel"
            className="mx-auto mt-3 h-auto max-h-64 max-w-full cursor-crosshair rounded-xl border" />
          {picked && thumbnails && <Button className="mt-3" variant="outline" onClick={() => copy(picked, picked)}><Pipette />{picked}</Button>}
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        </ToolPanel>
        <ToolPanel stage="settings" title="Palette size">
          <label className="block text-sm font-medium">Number of colors
            <select className="mt-2 block h-10 w-full rounded-lg border bg-background px-3" value={paletteSize} onChange={event => setPaletteSize(Number(event.target.value))}>
              {[4, 6, 8, 12, 16].map(size => <option key={size}>{size}</option>)}
            </select>
          </label>
        </ToolPanel>
        <ToolPanel stage="result" title="Color palette" action={colors.length > 0 && <Button variant="outline" onClick={() => copy("palette",
          ":root {\n" + colors.map((color, i) => "  --color-" + (i + 1) + ": " + color.hex + ";").join("\n") + "\n}")}>
          {copied === "palette" ? <Check /> : <Copy />} CSS variables
        </Button>}>
          {colors.length ? <>
            <div className="mb-3 flex h-10 overflow-hidden rounded-lg" aria-hidden="true">
              {colors.map(color => <span key={color.hex} style={{ backgroundColor: color.hex, flex: color.count }} />)}
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {colors.map(color => <li key={color.hex} className="flex items-center gap-2 rounded-lg border bg-background p-2">
                <span className="size-8 shrink-0 rounded border" style={{ backgroundColor: color.hex }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm">{color.hex}</span>
                  <span className="block text-xs text-muted-foreground">{color.rgb} · {color.percent}%</span>
                </span>
                <Button variant="ghost" size="icon" aria-label={"Copy " + color.hex} onClick={() => copy(color.hex, color.hex)}>
                  {copied === color.hex ? <Check /> : <Copy />}
                </Button>
              </li>)}
            </ul>
          </> : <p className="studio-empty">{file ? "No opaque colors found." : "Choose an image to build a color palette."}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
