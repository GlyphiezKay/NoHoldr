"use client";

import { useState } from "react";
import { Download, FileText, Minimize2 } from "lucide-react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { downloadFile, formatBytes } from "@/lib/download-manager";
import { compressPdf, scanLevels, type CompressionOptions } from "@/lib/pdf-compression";

const modes = [
  { id: "text", name: "Keep text selectable", description: "Optimize the PDF structure without turning pages into images. Best for text documents. Savings may be small." },
  { id: "scan", name: "Shrink scanned pages", description: "Rebuild pages as compressed images. Text selection, clickable links, and interactive forms are lost in the compressed copy." },
] as const;
const maxFileBytes = 200 * 1024 * 1024;

export default function CompressPDFPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<CompressionOptions["mode"]>("text");
  const [level, setLevel] = useState<number>(1);
  const [target, setTarget] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; pages: number; targetBytes?: number; mode: CompressionOptions["mode"] } | null>(null);
  const reduced = Boolean(file && result && result.blob.size < file.size);

  function selectFile(files: File[]) {
    if (files.length !== 1) { setError("Choose one PDF at a time."); return; }
    const source = files[0];
    if (!(source.type === "application/pdf" || /\.pdf$/i.test(source.name))) {
      setError("Choose a PDF file.");
      return;
    }
    if (source.size > maxFileBytes || source.size === 0) {
      setError("Choose a non-empty PDF up to 200 MB.");
      return;
    }
    setError("");
    setResult(null);
    setFile(source);
  }

  async function run() {
    if (!file || running) return;
    const value = Number(target);
    if (mode === "scan" && target && (!Number.isSafeInteger(value) || value < 1 || value > 204_800)) {
      setError("Enter a whole number from 1 to 204800 KB or leave the target blank.");
      return;
    }
    const targetBytes = mode === "scan" && target ? value * 1024 : undefined;
    const options: CompressionOptions = mode === "text" ? { mode } : { mode, level, targetBytes };
    setError("");
    setResult(null);
    setStatus("Opening PDF…");
    setProgress(0);
    setRunning(true);
    try {
      const output = await compressPdf(file, options, (percent, message) => {
        setProgress(percent);
        setStatus(message);
      });
      setResult({ ...output, targetBytes, mode });
    } catch {
      setError("Could not process this PDF. Check that the file opens normally and has no password protection.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title="Compress PDF" description="Reduce a PDF’s size for sharing or uploads, then compare the result with the original.">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="space-y-5">
          <ToolPanel title="Source PDF" action={file && <Button variant="ghost" size="sm" disabled={running} onClick={() => { setFile(null); setResult(null); setError(""); }}>Remove</Button>}>
            {file && <div className="mb-4 flex items-center gap-3 rounded-lg border bg-background p-3">
              <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={file.name}>{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
            </div>}
            <FilePicker accept=".pdf,application/pdf" onFiles={selectFile} action={file ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF up to 200 MB here." disabled={running} />
          </ToolPanel>

          <ToolPanel title="Result" description={!result ? "Run compression to compare file sizes here." : undefined}>
            {result && file && (
              <>
                <dl className="grid grid-cols-2 gap-2 rounded-lg border bg-background p-3">
                  <div><dt className="text-sm text-muted-foreground">Original</dt><dd className="font-semibold">{formatBytes(file.size)}</dd></div>
                  <div><dt className="text-sm text-muted-foreground">Best result</dt><dd className="font-semibold">{formatBytes(result.blob.size)}</dd></div>
                </dl>
                <p role="status" className="mt-3 text-sm text-muted-foreground">
                  {reduced ? formatBytes(file.size - result.blob.size) + " saved" : "The original is the smallest copy found."} · {result.pages} {result.pages === 1 ? "page" : "pages"}
                </p>
                {result.targetBytes && <p className="mt-2 text-sm font-medium">
                  {result.blob.size <= result.targetBytes ? "Target met" : "Target not reached"} · {formatBytes(result.targetBytes)}
                  {result.blob.size !== result.targetBytes && " · " + formatBytes(Math.abs(result.blob.size - result.targetBytes)) + (result.blob.size < result.targetBytes ? " below target" : " above target")}
                </p>}
                {reduced && result.mode === "scan" && <p className="mt-2 text-sm text-muted-foreground">The compressed copy contains page images.</p>}
                <Button className="mt-4 w-full" size="lg" onClick={() => downloadFile(result.blob, reduced ? file.name.replace(/\.pdf$/i, "") + "_compressed.pdf" : file.name)}>
                  <Download /> {reduced ? "Download compressed PDF" : "Download original PDF"}
                </Button>
              </>
            )}
          </ToolPanel>
        </div>
        <ToolPanel title="Compression settings">
          <fieldset disabled={running} className="space-y-3">
            <legend className="mb-2 text-sm font-semibold">Compression method</legend>
            {modes.map(option => (
              <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 has-checked:border-primary has-checked:bg-accent">
                <input type="radio" name="compression-mode" className="mt-1 size-4 shrink-0 accent-primary" checked={mode === option.id} onChange={() => setMode(option.id)} />
                <span>
                  <span className="block text-sm font-semibold">{option.name}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{option.description}</span>
                </span>
              </label>
            ))}
            {mode === "scan" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium">Quality without a target
                  <select className="mt-2 h-9 w-full rounded-md border bg-background px-2 disabled:opacity-50" value={level} disabled={Boolean(target)} onChange={event => setLevel(Number(event.target.value))}>
                    {scanLevels.map(option => <option key={option.index} value={option.index}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">Target size in KB (optional)
                  <Input className="mt-2" type="number" min="1" max="204800" value={target} onChange={event => setTarget(event.target.value)} placeholder="e.g. 500" />
                </label>
                <p className="text-sm text-muted-foreground sm:col-span-2">With a target set, NoHoldr automatically tests multiple quality levels and keeps the closest result it finds below the limit. Some PDFs stay smaller even at the highest quality tested.</p>
              </div>
            )}
          </fieldset>
          <p className="mt-4 text-sm text-muted-foreground">Keep the original if it contains a digital signature. Rewriting a PDF can invalidate it.</p>
          <Button size="lg" className="mt-4 w-full" onClick={run} disabled={!file || running}><Minimize2 /> {running ? "Compressing…" : "Compress PDF"}</Button>
          {running && <div className="mt-4">
            <Progress value={progress} aria-label="Compression progress" />
            <p role="status" className="mt-2 text-sm text-muted-foreground">{status}</p>
          </div>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
