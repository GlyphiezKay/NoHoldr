"use client";

import { PdfPagePicker } from "@/components/pdf/pdf-page-picker";
import { ToolFile } from "@/components/layout/tool-file";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { useState, type PointerEvent } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilePicker } from "@/components/ui/file-picker";
import { cropPdf, redactPdf, type Redaction, type Region } from "@/lib/pdf-pages";
import { openPdf, renderPdfCanvas } from "@/lib/pdf-render";

type Preview = { page: number; count: number; width: number; height: number; url: string };

const fields = [
  { key: "left", label: "Left" }, { key: "top", label: "Top" },
  { key: "width", label: "Width" }, { key: "height", label: "Height" },
] as const;
const initial = { left: "10", top: "10", width: "80", height: "80" };

async function previewPage(file: File, number: number): Promise<Preview> {
  const task = await openPdf(file);
  try {
    const pdf = await task.promise;
    if (!Number.isInteger(number) || number < 1 || number > pdf.numPages) throw new Error("Select a valid page number.");
    const page = await pdf.getPage(number);
    const { canvas } = await renderPdfCanvas(page, 1000, 1.5);
    try {
      return { page: number, count: pdf.numPages, width: canvas.width, height: canvas.height, url: canvas.toDataURL("image/png") };
    } finally {
      canvas.width = canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await task.destroy().catch(() => {});
  }
}

function pointerPosition(event: PointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) * 100 / rect.width))),
    y: Math.round(Math.max(0, Math.min(100, (event.clientY - rect.top) * 100 / rect.height))),
  };
}

function regionStyle({ left, top, width, height }: Region) {
  return { left: left * 100 + "%", top: top * 100 + "%", width: width * 100 + "%", height: height * 100 + "%" };
}

export function PdfRegionTool({ operation }: { operation: "crop" | "redact" }) {
  const redact = operation === "redact";
  const title = redact ? "Redact PDF" : "Crop PDF";
  const [file, setFile] = useState<File | null>(null);
  const exported = useToolExport(file);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [page, setPage] = useState("1");
  const [selection, setSelection] = useState("1");
  const [bounds, setBounds] = useState(initial);
  const [queued, setQueued] = useState<Redaction[]>([]);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const region = Object.fromEntries(fields.map(({ key }) => [key, bounds[key] === "" ? NaN : Number(bounds[key]) / 100])) as Region;
  const valid = Object.values(region).every(Number.isFinite) && region.left >= 0 && region.top >= 0 &&
    region.width > 0 && region.height > 0 && region.left + region.width <= 1.000001 && region.top + region.height <= 1.000001;

  async function load(source: File, number: number, replace: boolean) {
    setBusy(true);
    setStatus("Rendering preview…");
    setError("");
    try {
      const rendered = await previewPage(source, number);
      setFile(source);
      setPreview(rendered);
      setPage(String(rendered.page));
      if (replace) {
        setQueued([]);
        setBounds(initial);
        setSelection("1");
      }
      setStatus("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not display the PDF.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function queue() {
    if (!preview || !valid) return;
    setQueued(items => [...items, { page: preview.page, region }]);
  }

  async function run() {
    if (!file || busy || (redact ? !queued.length : !valid)) return;
    setBusy(true);
    setError("");
    setStatus(redact ? "Creating a redacted copy…" : "Applying crop…");
    try {
      const output = redact
        ? await redactPdf(file, queued, (n, total) => setStatus("Rendering page " + n + " of " + total + "…"))
        : await cropPdf(file, selection, region);
      exported.save(output, file.name.replace(/\.pdf$/i, "") + (redact ? "_redacted.pdf" : "_cropped.pdf"));
      setStatus("Download ready.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not export the PDF.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title={title}
      description={redact ? "Cover sensitive page regions and export a new flattened PDF." : "Choose the portion of the page to keep and apply it to selected pages."}>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ToolPanel stage="input" title="Page preview" description={preview ? "Drag a rectangle or adjust the exact percentages in the settings." : undefined}>
          {file && <div className="mb-3"><ToolFile blob={file} name={file.name} /></div>}
          <FilePicker accept=".pdf,application/pdf" action={file ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy}
            onFiles={files => { if (files.length === 1) void load(files[0], 1, true); else setError("Choose one PDF."); }} />
          {preview && file && <div className="mt-4 space-y-4">
            <form onSubmit={event => { event.preventDefault(); void load(file, Number(page), false); }}>
              <PdfPagePicker file={file} total={preview.count} value={page} onChange={setPage} label="Preview page"
                kind="single" disabled={busy} onPageClick={number => void load(file, number, false)} />
              <Button className="mt-2" type="submit" variant="outline" disabled={busy}>Show page</Button>
            </form>
            <div className="relative mx-auto w-full max-w-lg touch-none overflow-hidden border bg-white"
              onPointerDown={event => {
                if (busy || event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setOrigin(pointerPosition(event));
              }}
              onPointerMove={event => {
                if (!origin) return;
                const end = pointerPosition(event);
                setBounds({ left: String(Math.min(origin.x, end.x)), top: String(Math.min(origin.y, end.y)),
                  width: String(Math.abs(end.x - origin.x)), height: String(Math.abs(end.y - origin.y)) });
              }}
              onPointerUp={() => setOrigin(null)} onPointerCancel={() => setOrigin(null)}>
              <Image src={preview.url} width={preview.width} height={preview.height} alt={"Preview of page " + preview.page} unoptimized className="pointer-events-none h-auto w-full select-none" />
              {queued.filter(item => item.page === preview.page).map((item, index) => <span key={index} className="pointer-events-none absolute bg-black" style={regionStyle(item.region)} />)}
              {valid && <span aria-hidden="true" className="pointer-events-none absolute border-2 border-dashed border-emerald-700 bg-emerald-300/25" style={regionStyle(region)} />}
            </div>
          </div>}
        </ToolPanel>
        <ToolPanel stage="settings" title={redact ? "Redaction areas" : "Crop settings"}>
          <fieldset disabled={!preview || busy} className="space-y-4">
            <legend className="mb-2 text-sm font-medium">{redact ? "Area to cover (%)" : "Area to retain (%)"}</legend>
            <div className="grid grid-cols-2 gap-3">
              {fields.map(({ key, label }) => <label key={key} className="block text-sm font-medium">{label}
                <Input className="mt-2" type="number" min="0" max="100" value={bounds[key]} onChange={event => setBounds(current => ({ ...current, [key]: event.target.value }))} />
              </label>)}
            </div>
            {preview && !valid && <p className="text-sm text-destructive">Enter a non-empty rectangle within the page.</p>}
            {redact ? <Button variant="outline" disabled={!valid} onClick={queue}>Add area on page {preview?.page ?? 1}</Button> :
              <PdfPagePicker file={file} total={preview?.count ?? 0} value={selection} onChange={setSelection}
                label="Pages to crop" ordered={false} disabled={busy} />}
          </fieldset>
          {queued.length > 0 && <ul className="mt-4 space-y-2">
            {queued.map((item, index) => <li key={index} className="flex items-center justify-between rounded-lg border bg-background p-2 pl-3 text-sm">
              Area {index + 1} on page {item.page}
              <Button variant="ghost" size="icon-sm" aria-label={"Remove area " + (index + 1)} disabled={busy}
                onClick={() => setQueued(items => items.filter((_, i) => i !== index))}><Trash2 /></Button>
            </li>)}
          </ul>}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{redact
            ? "The downloaded copy contains flattened page images. Review every page before sharing. Selectable text, links, and forms will be removed."
            : "Cropping changes the visible bounds. Use Redact PDF to remove sensitive content."}</p>
          <Button size="lg" className="mt-4 w-full" disabled={!preview || busy || (redact ? !queued.length : !valid || !selection.trim())} onClick={run}>
            {redact ? "Export redacted PDF" : "Crop and download"}
          </Button>
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
        <ToolOutput file={exported.file} />
      </div>
    </ToolWorkspace>
  );
}