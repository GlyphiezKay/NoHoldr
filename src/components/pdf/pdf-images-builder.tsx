"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { downloadPdfBytes } from "@/lib/pdf-utils";

type Entry = { id: string; file: File };
async function normalizedImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  try {
    const scale = Math.min(1, 4096 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image encoding failed.")), "image/jpeg", 0.9));
  } finally {
    bitmap.close();
    canvas.width = canvas.height = 0;
  }
}

export function PdfImagesBuilder({ scan }: { scan?: boolean }) {
  const [files, setFiles] = useState<Entry[]>([]);
  const [paper, setPaper] = useState("auto");
  const [margin, setMargin] = useState("18");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function add(incoming: File[]) {
    setError("");
    setStatus("");
    const items = incoming.map(file => ({ id: crypto.randomUUID(), file }));
    setFiles(current => [...current, ...items]);
  }
  function move(index: number, offset: number) {
    setFiles(current => {
      const next = [...current], target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function build() {
    if (busy || !files.length) return;
    const inset = Number(margin);
    if (margin === "" || !Number.isFinite(inset) || inset < 0 || inset > 100) { setError("Enter a margin from 0 to 100 pt."); return; }
    setBusy(true);
    setError("");
    try {
      const pdf = await PDFDocument.create();
      for (const [index, { file }] of files.entries()) {
        setStatus("Adding image " + (index + 1) + " of " + files.length + "…");
        let embedded;
        try {
          if (scan) embedded = await pdf.embedJpg(await (await normalizedImage(file)).arrayBuffer());
          else if (file.type === "image/png") embedded = await pdf.embedPng(await file.arrayBuffer());
          else if (file.type === "image/jpeg") embedded = await pdf.embedJpg(await file.arrayBuffer());
          else embedded = await pdf.embedJpg(await (await normalizedImage(file)).arrayBuffer());
        } catch {
          throw new Error("Could not read " + file.name + ". Remove it or replace it with a readable image.");
        }
        const scaled = embedded.scaleToFit(900, 900);
        const [width, height] = paper === "a4" ? [595.28, 841.89] : paper === "letter" ? [612, 792] : [scaled.width + 2 * inset, scaled.height + 2 * inset];
        const size = embedded.scaleToFit(width - 2 * inset, height - 2 * inset);
        pdf.addPage([width, height]).drawImage(embedded, { ...size, x: (width - size.width) / 2, y: (height - size.height) / 2 });
      }
      downloadPdfBytes(await pdf.save(), scan ? "scan.pdf" : "images.pdf");
      setStatus("Downloaded " + files.length + " pages.");
    } catch (reason) {
      setStatus("");
      setError(reason instanceof Error ? reason.message : "Could not create the PDF.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title={scan ? "Scan to PDF" : "Images to PDF"}
      description={scan ? "Take photos of documents or add existing scans, then assemble them into a PDF." : "Combine images into a PDF, with one image per page."}>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ToolPanel title="Page images" description="The order shown here is the order in the PDF.">
          <FilePicker multiple accept="image/*" action={files.length ? "Add images" : "Choose images"} hint="Or drop image files here." disabled={busy} onFiles={add} />
          {scan && <label className="mt-3 block text-sm font-medium">Take a photo
            <input type="file" accept="image/*" capture="environment" disabled={busy} className="mt-2 block w-full text-sm"
              onChange={event => {
                const photos = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = "";
                add(photos);
              }} />
          </label>}
          {files.length > 0 && <ol className="mt-4 space-y-2">
            {files.map(({ id, file }, index) => <li key={id} className="flex items-center gap-1 rounded-lg border bg-background p-2">
              <span className="min-w-0 flex-1 truncate text-sm">{index + 1}. {file.name}</span>
              <Button variant="ghost" size="icon-sm" aria-label={"Move " + file.name + " up"} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={"Move " + file.name + " down"} disabled={busy || index === files.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={"Remove " + file.name} disabled={busy} onClick={() => setFiles(current => current.filter(item => item.id !== id))}><X /></Button>
            </li>)}
          </ol>}
        </ToolPanel>
        <ToolPanel title="PDF layout">
          <label className="block text-sm font-medium">Page size
            <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={paper} disabled={busy} onChange={event => setPaper(event.target.value)}>
              <option value="auto">Fit each image</option><option value="a4">A4 (portrait)</option><option value="letter">US Letter (portrait)</option>
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium">Margin (pt)
            <Input className="mt-2" type="number" min="0" max="100" value={margin} disabled={busy} onChange={event => setMargin(event.target.value)} />
          </label>
          <Button className="mt-4 w-full" size="lg" disabled={!files.length || busy} onClick={build}>Create PDF</Button>
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
