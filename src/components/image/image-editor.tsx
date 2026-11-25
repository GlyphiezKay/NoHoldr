"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { downloadFile } from "@/lib/download-manager";
import { encodeCanvas, imageOutputName, makeImageCanvas, openLocalImage } from "@/lib/image-processing";

const operations = {
  edit: { title: "Photo Editor", description: "Adjust brightness, contrast and saturation, then add a caption anywhere on the image.", suffix: "_edited" },
  meme: { title: "Meme Generator", description: "Add top and bottom captions to an image and adjust the lettering.", suffix: "_meme" },
  blur: { title: "Hide Image Areas", description: "Pixelate faces, plates, or other regions, or cover them completely with solid boxes.", suffix: "_masked" },
  background: { title: "Remove Color Background", description: "Pick a background color to make it transparent. Works best on solid or nearly solid backgrounds.", suffix: "_transparent" },
  watermark: { title: "Watermark Image", description: "Place a text watermark or a logo on an image and adjust its opacity.", suffix: "_watermarked" },
} as const;

export type ImageEditorMode = keyof typeof operations;
type Box = { left: number; top: number; width: number; height: number };
type Mask = Box & { kind: "pixelate" | "cover" };
const defaultBox = { left: 25, top: 25, width: 50, height: 30 };
const initial = { brightness: 100, contrast: 100, saturation: 100, caption: "", bottom: "", size: 8, x: 50, y: 85,
  ink: "#ffffff", background: "#ffffff", tolerance: 26, connected: true, opacity: 40, tile: false, anchor: "center",
  logo: null as HTMLImageElement | null };
type EditorSettings = typeof initial;

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, ink: string) {
  if (!text.trim()) return;
  context.font = "bold " + size + "px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = Math.max(1, size / 12);
  context.strokeStyle = "#111111";
  context.fillStyle = ink;
  const max = Math.max(1, context.canvas.width * 0.92);
  context.strokeText(text, x, y, max);
  context.fillText(text, x, y, max);
}

function clearColor(context: CanvasRenderingContext2D, color: string, tolerance: number, connected: boolean) {
  const { width, height } = context.canvas;
  const frame = context.getImageData(0, 0, width, height);
  const values = frame.data;
  const [red, green, blue] = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  const radius = (tolerance * 2.55) ** 2 * 3;
  const matches = (pixel: number) => {
    const offset = pixel * 4;
    return values[offset + 3] === 0 || ((values[offset] - red) ** 2 +
      (values[offset + 1] - green) ** 2 + (values[offset + 2] - blue) ** 2 <= radius);
  };
  if (!connected) {
    for (let i = 0; i < width * height; i++) if (matches(i)) values[i * 4 + 3] = 0;
  } else {
    const queue = new Uint32Array(width * height);
    const visited = new Uint8Array(width * height);
    let tail = 0;
    function visit(pixel: number) {
      if (visited[pixel]) return;
      visited[pixel] = 1;
      if (matches(pixel)) queue[tail++] = pixel;
    }
    for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { visit(y * width); visit((y + 1) * width - 1); }
    for (let head = 0; head < tail; head++) {
      const pixel = queue[head];
      values[pixel * 4 + 3] = 0;
      if (pixel % width !== 0) visit(pixel - 1);
      if ((pixel + 1) % width !== 0) visit(pixel + 1);
      if (pixel >= width) visit(pixel - width);
      if (pixel < width * (height - 1)) visit(pixel + width);
    }
  }
  context.putImageData(frame, 0, 0);
}

function paint(context: CanvasRenderingContext2D, image: HTMLImageElement, operation: ImageEditorMode, settings: EditorSettings, masks: Mask[]) {
  const { width, height } = context.canvas;
  context.clearRect(0, 0, width, height);
  context.save();
  if (operation === "edit") context.filter = "brightness(" + settings.brightness + "%) contrast(" + settings.contrast + "%) saturate(" + settings.saturation + "%)";
  context.drawImage(image, 0, 0, width, height);
  context.restore();
  const size = Math.max(2, Math.round(Math.min(width, height) * settings.size / 100));
  if (operation === "edit") drawText(context, settings.caption, width * settings.x / 100, height * settings.y / 100, size, settings.ink);
  if (operation === "meme") {
    drawText(context, settings.caption, width / 2, size, size, settings.ink);
    drawText(context, settings.bottom, width / 2, height - size, size, settings.ink);
  }
  if (operation === "watermark") {
    const logo = settings.logo;
    const scale = logo ? Math.min(width, height) * settings.size / (100 * Math.max(logo.naturalWidth, logo.naturalHeight)) : 0;
    const markWidth = logo ? logo.naturalWidth * scale : Math.min(width * 0.9, size * settings.caption.length * 0.65);
    const markHeight = logo ? logo.naturalHeight * scale : size;
    context.save();
    context.globalAlpha = settings.opacity / 100;
    function draw(x: number, y: number) {
      if (logo) context.drawImage(logo, x - markWidth / 2, y - markHeight / 2, markWidth, markHeight);
      else drawText(context, settings.caption, x, y, size, settings.ink);
    }
    if (settings.tile) {
      const stepX = Math.max(width / 12, markWidth + size), stepY = Math.max(height / 12, markHeight + size * 1.5);
      for (let y = stepY / 2; y < height; y += stepY) {
        for (let x = stepX / 2; x < width; x += stepX) draw(x, y);
      }
    } else {
      const margin = Math.min(width, height) * 0.045;
      const x = settings.anchor.endsWith("left") ? margin + markWidth / 2 : settings.anchor.endsWith("right") ? width - margin - markWidth / 2 : width / 2;
      const y = settings.anchor.startsWith("top") ? margin + markHeight / 2 : settings.anchor.startsWith("bottom") ? height - margin - markHeight / 2 : height / 2;
      draw(x, y);
    }
    context.restore();
  }
  if (operation === "background") clearColor(context, settings.background, settings.tolerance, settings.connected);
  if (operation === "blur") {
    for (const mask of masks) {
      const left = Math.floor(width * mask.left / 100), top = Math.floor(height * mask.top / 100);
      const w = Math.ceil(width * (mask.left + mask.width) / 100) - left;
      const h = Math.ceil(height * (mask.top + mask.height) / 100) - top;
      if (mask.kind === "cover") {
        context.fillStyle = "#000000";
        context.fillRect(left, top, w, h);
      } else {
        const { canvas, context: reduced } = makeImageCanvas(Math.min(12, w), Math.min(12, h));
        reduced.drawImage(context.canvas, left, top, w, h, 0, 0, canvas.width, canvas.height);
        context.save();
        context.imageSmoothingEnabled = false;
        context.clearRect(left, top, w, h);
        context.drawImage(canvas, left, top, w, h);
        context.restore();
        canvas.width = canvas.height = 0;
      }
    }
  }
}

function position(event: PointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: Math.round(Math.min(100, Math.max(0, (event.clientX - rect.left) * 100 / rect.width))),
    y: Math.round(Math.min(100, Math.max(0, (event.clientY - rect.top) * 100 / rect.height))) };
}

export function ImageEditor({ mode }: { mode: ImageEditorMode }) {
  const info = operations[mode];
  const [source, setSource] = useState<{ file: File; image: HTMLImageElement } | null>(null);
  const [settings, setSettings] = useState(initial);
  const [masks, setMasks] = useState<Mask[]>([]);
  const [box, setBox] = useState(defaultBox);
  const [kind, setKind] = useState<Mask["kind"]>("cover");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [format, setFormat] = useState<"png" | "webp">("png");
  const preview = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const validBox = box.left >= 0 && box.top >= 0 && box.width > 0 && box.height > 0 && box.left + box.width <= 100 && box.top + box.height <= 100;

  useEffect(() => {
    const canvas = preview.current;
    if (!source || !canvas) return;
    const scale = Math.min(1, 850 / Math.max(source.image.naturalWidth, source.image.naturalHeight));
    canvas.width = Math.max(1, Math.round(scale * source.image.naturalWidth));
    canvas.height = Math.max(1, Math.round(scale * source.image.naturalHeight));
    const context = canvas.getContext("2d");
    if (context) paint(context, source.image, mode, settings, masks);
  }, [source, mode, settings, masks]);

  function update<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) {
    setSettings(current => ({ ...current, [key]: value }));
  }

  async function load(files: File[]) {
    if (files.length !== 1) { setError("Choose one image."); return; }
    setBusy(true);
    setError("");
    try {
      const image = await openLocalImage(files[0]);
      if (mode === "background" && image.naturalWidth * image.naturalHeight > 12_000_000) {
        setError("Resize images larger than 12 megapixels before removing a background.");
        return;
      }
      setSource({ file: files[0], image });
      setMasks([]);
      setBox(defaultBox);
      setSettings(initial);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open this image.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!source || busy || (mode === "blur" && !masks.length) || (mode === "watermark" && !settings.logo && !settings.caption.trim())) return;
    setBusy(true);
    setError("");
    try {
      const { canvas, context } = makeImageCanvas(source.image.naturalWidth, source.image.naturalHeight);
      try {
        paint(context, source.image, mode, settings, masks);
        const blob = await encodeCanvas(canvas, "image/" + format, 0.92);
        downloadFile(blob, imageOutputName(source.file, info.suffix, format));
      } finally {
        canvas.width = canvas.height = 0;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not export this image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="Image tools" backHref="/image" title={info.title} description={info.description}>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ToolPanel title="Image preview" action={source && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setSettings(initial); setMasks([]); setBox(defaultBox); }}><RotateCcw />Reset</Button>}>
          <FilePicker accept="image/*" action={source ? "Replace image" : "Choose image"} hint="Or drop an image here." disabled={busy} onFiles={load} />
          {source && <div className="mt-4 flex justify-center overflow-hidden rounded border bg-muted">
            <div className={"relative max-w-full " + (mode === "blur" ? "touch-none cursor-crosshair" : "")}
              onPointerDown={event => {
                if (mode !== "blur" || busy || event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                start.current = position(event);
              }}
              onPointerMove={event => {
                const origin = start.current;
                if (!origin) return;
                const end = position(event);
                setBox({ left: Math.min(origin.x, end.x), top: Math.min(origin.y, end.y), width: Math.abs(end.x - origin.x), height: Math.abs(end.y - origin.y) });
              }}
              onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; }}>
              <canvas ref={preview} role="img" aria-label="Edited image preview" className="block h-auto max-w-full" />
              {mode === "blur" && validBox && <span aria-hidden="true" className="pointer-events-none absolute border-2 border-dashed border-emerald-600 bg-emerald-400/15" style={{ left: box.left + "%", top: box.top + "%", width: box.width + "%", height: box.height + "%" }} />}
            </div>
          </div>}
        </ToolPanel>
        <ToolPanel title="Settings">
          <fieldset disabled={!source || busy} className="space-y-3">
            {mode === "edit" && <>
              {(["brightness", "contrast", "saturation"] as const).map(key => <label key={key} className="block text-sm font-medium capitalize">{key} · {settings[key]}%
                <input type="range" min="0" max="200" value={settings[key]} className="mt-2 block w-full accent-primary" onChange={event => update(key, Number(event.target.value))} />
              </label>)}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">Caption X (%)<Input min="0" max="100" type="number" className="mt-1" value={settings.x} onChange={event => update("x", Math.min(100, Math.max(0, Number(event.target.value))))} /></label>
                <label className="text-sm font-medium">Caption Y (%)<Input min="0" max="100" type="number" className="mt-1" value={settings.y} onChange={event => update("y", Math.min(100, Math.max(0, Number(event.target.value))))} /></label>
              </div>
            </>}
            {(mode === "edit" || mode === "meme") && <>
              <label className="block text-sm font-medium">{mode === "meme" ? "Top text" : "Caption"}<Input className="mt-1" maxLength={200} value={settings.caption} onChange={event => update("caption", event.target.value)} /></label>
              {mode === "meme" && <label className="block text-sm font-medium">Bottom text<Input className="mt-1" maxLength={200} value={settings.bottom} onChange={event => update("bottom", event.target.value)} /></label>}
              <label className="block text-sm font-medium">Text size · {settings.size}%<input className="mt-1 block w-full accent-primary" type="range" min="2" max="22" value={settings.size} onChange={event => update("size", Number(event.target.value))} /></label>
              <label className="flex items-center gap-2 text-sm font-medium">Text color<input type="color" value={settings.ink} onChange={event => update("ink", event.target.value)} /></label>
            </>}
            {mode === "background" && <>
              <label className="flex items-center gap-2 text-sm font-medium">Background color<input type="color" value={settings.background} onChange={event => update("background", event.target.value)} /></label>
              <label className="block text-sm font-medium">Tolerance · {settings.tolerance}%<input type="range" min="0" max="100" value={settings.tolerance} className="mt-2 block w-full accent-primary" onChange={event => update("tolerance", Number(event.target.value))} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.connected} className="accent-primary" onChange={event => update("connected", event.target.checked)} />Only remove matching areas connected to an edge</label>
            </>}
            {mode === "watermark" && <>
              {settings.logo ? <Button size="sm" variant="outline" onClick={() => update("logo", null)}>Remove logo</Button> : <>
                <label className="block text-sm font-medium">Watermark text<Input className="mt-1" value={settings.caption} maxLength={90} onChange={event => update("caption", event.target.value)} /></label>
                <label className="flex items-center gap-2 text-sm font-medium">Text color<input type="color" value={settings.ink} onChange={event => update("ink", event.target.value)} /></label>
              </>}
              <label className="block text-sm font-medium">Logo image <input type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={async event => {
                const logo = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!logo) return;
                setError("");
                setBusy(true);
                try { update("logo", await openLocalImage(logo)); }
                catch (reason) { setError(reason instanceof Error ? reason.message : "Could not open the logo."); }
                finally { setBusy(false); }
              }} /></label>
              <label className="block text-sm font-medium">Watermark size · {settings.size}%<input type="range" min="2" max="35" className="mt-2 block w-full accent-primary" value={settings.size} onChange={event => update("size", Number(event.target.value))} /></label>
              <label className="block text-sm font-medium">Opacity · {settings.opacity}%<input type="range" min="5" max="100" className="mt-2 block w-full accent-primary" value={settings.opacity} onChange={event => update("opacity", Number(event.target.value))} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={settings.tile} onChange={event => update("tile", event.target.checked)} />Repeat across image</label>
              {!settings.tile && <label className="block text-sm font-medium">Position<select className="mt-2 h-9 w-full rounded border bg-background px-2" value={settings.anchor} onChange={event => update("anchor", event.target.value)}>
                <option value="center">Center</option><option value="top-left">Top left</option><option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option>
              </select></label>}
            </>}
            {mode === "blur" && <>
              <p className="text-sm text-muted-foreground">Drag a box on the preview or enter percentages. Solid cover gives the strongest masking.</p>
              <label className="block text-sm font-medium">Mask type<select className="mt-1 block h-9 w-full rounded border bg-background px-2" value={kind} onChange={event => setKind(event.target.value as Mask["kind"])}>
                <option value="cover">Solid cover</option><option value="pixelate">Pixelate</option>
              </select></label>
              <div className="grid grid-cols-2 gap-2">
                {(["left", "top", "width", "height"] as const).map(key => <label key={key} className="text-sm font-medium capitalize">{key} (%)
                  <Input className="mt-1" type="number" min="0" max="100" value={box[key]} onChange={event => setBox(current => ({ ...current, [key]: Number(event.target.value) }))} />
                </label>)}
              </div>
              <Button variant="outline" disabled={!validBox} onClick={() => setMasks(current => [...current, { ...box, kind }])}>Add masked area</Button>
              {masks.map((mask, index) => <div key={index} className="flex items-center justify-between rounded border bg-background p-2 pl-3 text-sm">
                Area {index + 1} · {mask.kind === "cover" ? "Solid cover" : "Pixelated"}
                <Button variant="ghost" size="icon-sm" aria-label={"Remove area " + (index + 1)} onClick={() => setMasks(current => current.filter((_, i) => i !== index))}><Trash2 /></Button>
              </div>)}
            </>}
            <label className="block text-sm font-medium">Output format<select className="mt-1 block h-9 w-full rounded border bg-background px-2" value={format} onChange={event => setFormat(event.target.value as typeof format)}>
              <option value="png">PNG</option><option value="webp">WebP</option>
            </select></label>
          </fieldset>
          <Button className="mt-4 w-full" size="lg" disabled={!source || busy || (mode === "blur" && !masks.length) || (mode === "watermark" && !settings.logo && !settings.caption.trim())} onClick={save}><Download />Export image</Button>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
