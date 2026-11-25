"use client";

import { useState } from "react";
import Image from "next/image";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openPdf, renderPdfCanvas } from "@/lib/pdf-render";

async function snapshot(file: File, number: number) {
  const task = await openPdf(file);
  try {
    const pdf = await task.promise;
    if (number > pdf.numPages) return { pages: pdf.numPages, canvas: null, width: 0, height: 0 };
    const page = await pdf.getPage(number);
    const { canvas, original } = await renderPdfCanvas(page, 1000, 1);
    return { pages: pdf.numPages, canvas, width: original.width, height: original.height };
  } finally {
    await task.destroy().catch(() => {});
  }
}

type Snapshot = Awaited<ReturnType<typeof snapshot>>;

function compare(a: Snapshot, b: Snapshot) {
  const c = a.canvas;
  const d = b.canvas;
  if (!c || !d) return "This page exists in only one of the selected PDFs.";
  if (Math.abs(a.width - b.width) > 0.01 || Math.abs(a.height - b.height) > 0.01 || c.width !== d.width || c.height !== d.height) {
    return "The visible page sizes differ.";
  }
  const left = c.getContext("2d")?.getImageData(0, 0, c.width, c.height).data;
  const right = d.getContext("2d")?.getImageData(0, 0, d.width, d.height).data;
  if (!left || !right) throw new Error("The browser could not read the rendered pages.");
  let changed = 0;
  for (let i = 0; i < left.length; i += 4) {
    if (Math.max(Math.abs(left[i] - right[i]), Math.abs(left[i + 1] - right[i + 1]), Math.abs(left[i + 2] - right[i + 2])) > 12) changed++;
  }
  return changed ? "Rendered pixels changed: " + changed.toLocaleString() + " (" + (changed * 100 / (c.width * c.height)).toFixed(2) + "%)." :
    "No visible differences detected at preview resolution.";
}

export default function ComparePdf() {
  const [left, setLeft] = useState<File | null>(null);
  const [right, setRight] = useState<File | null>(null);
  const [page, setPage] = useState("1");
  const [result, setResult] = useState<{ message: string; page: number; snapshots: Array<{ url?: string; width: number; height: number; pages: number }> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function choose(files: File[], index: number) {
    if (files.length !== 1) { setError("Choose one PDF for each side."); return; }
    if (index === 0) setLeft(files[0]);
    else setRight(files[0]);
    setResult(null);
    setError("");
  }

  async function run() {
    if (!left || !right || busy) return;
    const number = Number(page);
    if (!Number.isInteger(number) || number < 1) { setError("Enter a positive page number."); return; }
    setBusy(true);
    setError("");
    setResult(null);
    const snapshots: Snapshot[] = [];
    try {
      snapshots.push(await snapshot(left, number));
      snapshots.push(await snapshot(right, number));
      if (snapshots.every(item => !item.canvas)) throw new Error("Neither file contains that page.");
      setResult({ page: number, message: compare(snapshots[0], snapshots[1]), snapshots: snapshots.map(item => ({
        pages: item.pages, url: item.canvas?.toDataURL("image/png"),
        width: item.canvas?.width ?? 0, height: item.canvas?.height ?? 0,
      })) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not compare the PDFs.");
    } finally {
      for (const item of snapshots) if (item.canvas) item.canvas.width = item.canvas.height = 0;
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title="Compare PDFs" description="Compare pages side by side and measure visible changes at preview resolution.">
      <div className="grid gap-5 sm:grid-cols-2">
        {[left, right].map((file, index) => <ToolPanel key={index} title={index === 0 ? "Original PDF" : "Revised PDF"}>
          {file && <p className="mb-3 break-all rounded-lg border bg-background p-3 text-sm">{file.name}</p>}
          <FilePicker accept=".pdf,application/pdf" onFiles={files => choose(files, index)} action={file ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy} />
        </ToolPanel>)}
      </div>
      <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void run(); }}>
        <label className="text-sm font-medium">Page number
          <Input className="mt-2 max-w-28" type="number" min="1" value={page} disabled={busy} onChange={event => setPage(event.target.value)} />
        </label>
        <Button type="submit" disabled={busy || !left || !right}>{busy ? "Rendering…" : "Compare page"}</Button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {result && <section className="mt-6">
        <h2 className="text-lg font-semibold">Page {result.page}</h2>
        <p role="status" className="mt-1 mb-3 text-sm text-muted-foreground">{result.message}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {result.snapshots.map((item, index) => <ToolPanel key={index} title={index === 0 ? "Original" : "Revised"} description={item.pages + " pages"}>
            {item.url ? <Image src={item.url} alt={(index === 0 ? "Original" : "Revised") + " page " + result.page} width={item.width} height={item.height} unoptimized className="mx-auto h-auto max-w-full border" /> :
              <p className="text-sm text-muted-foreground">No page at this position.</p>}
          </ToolPanel>)}
        </div>
      </section>}
    </ToolWorkspace>
  );
}
