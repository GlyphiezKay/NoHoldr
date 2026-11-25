"use client";

import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { downloadPdfBytes } from "@/lib/pdf-utils";

type Item = { kind: "text" | "rectangle" | "image"; page: number; x: number; y: number; width: number; height: number; value: string; color: string; image: File | null };

export default function EditPdf() {
  const [source, setSource] = useState<{ file: File; pages: number } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [kind, setKind] = useState<Item["kind"]>("text");
  const [position, setPosition] = useState({ page: "1", x: "36", y: "36", width: "120", height: "24" });
  const [value, setValue] = useState("");
  const [color, setColor] = useState("#202020");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function read(files: File[]) {
    if (files.length !== 1) { setError("Choose one PDF."); return; }
    setBusy(true);
    setError("");
    try {
      const pdf = await PDFDocument.load(await files[0].arrayBuffer());
      setSource({ file: files[0], pages: pdf.getPageCount() });
      setItems([]);
    } catch {
      setError("Could not open this PDF.");
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!source) return;
    const page = Number(position.page), x = Number(position.x), y = Number(position.y);
    const width = Number(position.width), height = Number(position.height);
    if (!Number.isInteger(page) || page < 1 || page > source.pages || [x, y, width, height].some(n => !Number.isFinite(n)) ||
      x < 0 || y < 0 || height <= 0 || (kind !== "text" && width <= 0) || (kind === "text" && !value.trim()) || (kind === "image" && !image)) {
      setError("Enter the content, page, and valid position and dimensions before adding.");
      return;
    }
    setItems(current => [...current, { kind, page, x, y, width, height, value, color, image }]);
    setError("");
  }

  async function save() {
    if (!source || busy || items.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const pdf = await PDFDocument.load(await source.file.arrayBuffer(), { updateMetadata: false });
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      for (const item of items) {
        const page = pdf.getPage(item.page - 1);
        if (page.getRotation().angle % 360 !== 0) throw new Error("Rotate page " + item.page + " to the document’s base orientation before placing edits.");
        const box = page.getCropBox();
        const x = box.x + item.x;
        const y = box.y + box.height - item.y - item.height;
        let width = item.width;
        let text = item.value;
        if (item.kind === "text") {
          text = text.replace(/[\r\n\t]/g, " ");
          try { width = font.widthOfTextAtSize(text, item.height); }
          catch { throw new Error("The added text contains characters that Helvetica cannot encode."); }
        }
        if (item.x + width > box.width || item.y + item.height > box.height) {
          throw new Error("An item falls outside page " + item.page + ". Reduce its size or move it.");
        }
        const color = rgb(...[1, 3, 5].map(offset => parseInt(item.color.slice(offset, offset + 2), 16) / 255) as [number, number, number]);
        if (item.kind === "text") page.drawText(text, { x, y, font, size: item.height, color });
        if (item.kind === "rectangle") page.drawRectangle({ x, y, width, height: item.height, color });
        if (item.kind === "image" && item.image) {
          const bytes = await item.image.arrayBuffer();
          const asset = item.image.type === "image/png" || /\.png$/i.test(item.image.name) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const size = asset.scaleToFit(width, item.height);
          page.drawImage(asset, { ...size, x, y: y + item.height - size.height });
        }
      }
      downloadPdfBytes(await pdf.save({ updateFieldAppearances: false }), source.file.name.replace(/\.pdf$/i, "") + "_edited.pdf");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not write the edited PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title="Edit PDF" description="Add text, images, and shapes while preserving the original page contents.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <ToolPanel title="Source PDF">
            {source && <p className="mb-3 break-all text-sm font-medium">{source.file.name} · {source.pages} pages</p>}
            <FilePicker accept=".pdf,application/pdf" onFiles={read} action={source ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy} />
          </ToolPanel>
          {items.length > 0 && <ToolPanel title="Queued edits">
            <ol className="space-y-2">{items.map((item, index) => <li key={index} className="flex items-center gap-2 rounded-lg border bg-background p-2">
              <span className="min-w-0 flex-1 truncate text-sm">Page {item.page} · {item.kind === "text" ? item.value : item.image?.name ?? item.kind}</span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setItems(current => current.filter((_, i) => i !== index))}>Remove</Button>
            </li>)}</ol>
            <Button className="mt-4 w-full" disabled={busy} onClick={save}>Save edited PDF</Button>
          </ToolPanel>}
        </div>
        <ToolPanel title="New edit" description="Positions are measured in points from the top-left of an unrotated page. Use Redact PDF to remove sensitive content.">
          <fieldset disabled={!source || busy} className="space-y-3">
            <label className="block text-sm font-medium">Content type
              <select className="mt-1 block h-9 w-full rounded border bg-background px-2" value={kind} onChange={event => setKind(event.target.value as Item["kind"])}>
                <option value="text">Text</option><option value="rectangle">Rectangle</option><option value="image">Image</option>
              </select>
            </label>
            {kind === "text" && <label className="block text-sm font-medium">Text<Input className="mt-1" value={value} onChange={event => setValue(event.target.value)} /></label>}
            {kind === "image" ? <label className="block text-sm font-medium">PNG or JPEG image
              <input type="file" accept="image/png,image/jpeg" className="mt-1 block w-full" onChange={event => setImage(event.target.files?.[0] ?? null)} />
            </label> : <label className="flex items-center gap-2 text-sm font-medium">Color<input type="color" value={color} onChange={event => setColor(event.target.value)} /></label>}
            <div className="grid grid-cols-2 gap-2">
              {(["page", "x", "y", "width", "height"] as const).filter(key => kind !== "text" || key !== "width").map(key =>
                <label key={key} className="block text-sm font-medium capitalize">{key === "height" && kind === "text" ? "Font size" : key}
                  <Input type="number" className="mt-1" value={position[key]} onChange={event => setPosition(current => ({ ...current, [key]: event.target.value }))} />
                </label>)}
            </div>
            <Button variant="outline" onClick={add}>Add edit</Button>
          </fieldset>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}