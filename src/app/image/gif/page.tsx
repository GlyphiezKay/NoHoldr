"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadFile } from "@/lib/download-manager";
import { gifFile, makeImageCanvas, openLocalImage } from "@/lib/image-processing";

type Frame = { id: string; file: File };

export default function MakeGif() {
  const [files, setFiles] = useState<Frame[]>([]);
  const [width, setWidth] = useState("640");
  const [height, setHeight] = useState("480");
  const [delay, setDelay] = useState("300");
  const [loop, setLoop] = useState(true);
  const [matte, setMatte] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  function add(selected: File[]) {
    if (files.length + selected.length > 60) { setError("A GIF can contain up to 60 frames here."); return; }
    const incoming = selected.map(file => ({ id: crypto.randomUUID(), file }));
    setFiles(current => [...current, ...incoming]);
    setError("");
    setStatus("");
  }
  function move(index: number, offset: number) {
    setFiles(current => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function run() {
    if (busy || files.length < 2) return;
    const w = Number(width), h = Number(height), ms = Number(delay);
    if ([w, h].some(value => !Number.isInteger(value) || value < 1 || value > 1024) || !Number.isInteger(ms) || ms < 20 || ms > 10000) {
      setError("Enter dimensions from 1 to 1,024 px and a delay from 20 to 10,000 ms.");
      return;
    }
    setBusy(true);
    setError("");
    async function* frames() {
      const { canvas, context } = makeImageCanvas(w, h);
      try {
        for (const [index, { file }] of files.entries()) {
          setStatus("Encoding frame " + (index + 1) + " of " + files.length + "…");
          let image;
          try { image = await openLocalImage(file); }
          catch { throw new Error("Could not decode " + file.name + ". Remove or replace that frame."); }
          const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
          const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
          context.fillStyle = matte;
          context.fillRect(0, 0, w, h);
          context.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
          yield canvas;
        }
      } finally {
        canvas.width = canvas.height = 0;
      }
    }
    try {
      downloadFile(await gifFile(frames(), ms, loop ? 0 : -1), "noholdr_animation.gif");
      setStatus("Download ready.");
    } catch (reason) {
      setStatus("");
      setError(reason instanceof Error ? reason.message : "Could not export the GIF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="Image tools" backHref="/image" title="Make Animated GIF" description="Arrange multiple images as frames and set the duration and loop behavior.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ToolPanel title="Frames" description="Frames play in the order shown. Each source uses its first image frame.">
          <FilePicker accept="image/*" multiple action={files.length ? "Add frames" : "Choose images"} hint="Or drop two or more images here." disabled={busy} onFiles={add} />
          {files.length > 0 && <ol className="mt-3 space-y-2">
            {files.map(({ id, file }, index) => <li key={id} className="flex items-center gap-1 rounded border bg-background p-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{index + 1}. {file.name}</span>
              <Button aria-label={"Move " + file.name + " up"} size="icon-sm" variant="ghost" disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
              <Button aria-label={"Move " + file.name + " down"} size="icon-sm" variant="ghost" disabled={busy || index === files.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
              <Button aria-label={"Remove " + file.name} size="icon-sm" variant="ghost" disabled={busy} onClick={() => setFiles(current => current.filter(item => item.id !== id))}><X /></Button>
            </li>)}
          </ol>}
        </ToolPanel>
        <ToolPanel title="Animation settings">
          <fieldset disabled={busy} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Width (px)<Input type="number" min="1" max="1024" className="mt-1" value={width} onChange={event => setWidth(event.target.value)} /></label>
              <label className="text-sm font-medium">Height (px)<Input type="number" min="1" max="1024" className="mt-1" value={height} onChange={event => setHeight(event.target.value)} /></label>
            </div>
            <label className="block text-sm font-medium">Frame delay (ms)<Input type="number" min="20" max="10000" className="mt-1" value={delay} onChange={event => setDelay(event.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm">Background<input type="color" value={matte} onChange={event => setMatte(event.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={loop} onChange={event => setLoop(event.target.checked)} />Loop animation</label>
          </fieldset>
          <Button className="mt-4 w-full" size="lg" disabled={busy || files.length < 2} onClick={run}>Create GIF</Button>
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}