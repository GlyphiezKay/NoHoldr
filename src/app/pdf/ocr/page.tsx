"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Progress } from "@/components/ui/progress";
import { downloadFile, formatBytes } from "@/lib/download-manager";
import { recognizePdf } from "@/lib/pdf-ocr";

export default function OcrPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<"eng" | "ind" | "eng+ind">("eng+ind");
  const [result, setResult] = useState<Awaited<ReturnType<typeof recognizePdf>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (!file || busy) return;
    setBusy(true);
    setProgress(0);
    setStatus("Opening PDF…");
    setResult(null);
    setError("");
    try {
      setResult(await recognizePdf(file, language, (value, message) => {
        setProgress(value);
        setStatus(message);
      }));
    } catch {
      setError("OCR could not finish. Check that the PDF opens without a password and try a smaller scan if it is large.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title="OCR PDF" description="Add searchable text to scanned PDF pages using English, Indonesian, or both.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ToolPanel title="Source PDF">
          {file && <p className="mb-3 break-all rounded-lg border bg-background p-3 text-sm">{file.name} · {formatBytes(file.size)}</p>}
          <FilePicker accept=".pdf,application/pdf" action={file ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy} onFiles={files => {
            if (files.length !== 1) { setError("Choose one PDF."); return; }
            setFile(files[0]);
            setResult(null);
            setError("");
          }} />
        </ToolPanel>
        <ToolPanel title="Recognition settings" description="Pages that already contain selectable text are kept. Review the result if the scan is blurry or handwritten.">
          <label className="block text-sm font-medium">Document language
            <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={language} disabled={busy} onChange={event => setLanguage(event.target.value as typeof language)}>
              <option value="eng+ind">English and Indonesian</option><option value="eng">English</option><option value="ind">Indonesian</option>
            </select>
          </label>
          <Button size="lg" className="mt-4 w-full" disabled={!file || busy} onClick={run}>Recognize text</Button>
          {busy && <div className="mt-4"><Progress value={progress} aria-label="OCR progress" /><p role="status" className="mt-2 text-sm text-muted-foreground">{status}</p></div>}
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          {result && file && <div className="mt-4 space-y-3 rounded-lg border bg-background p-4">
            <p role="status" className="text-sm">{result.words ? "Added searchable text to " + result.recognizedPages + " page(s)." : "No new text layer was added."}</p>
            <div className="flex flex-wrap gap-2">
              {result.words > 0 && <Button variant="outline" onClick={() => downloadFile(result.blob, file.name.replace(/\.pdf$/i, "") + "_searchable.pdf")}><Download />Searchable PDF</Button>}
              {result.transcript.trim() && <Button variant="outline" onClick={() => downloadFile(new Blob([result.transcript], { type: "text/plain;charset=utf-8" }), file.name.replace(/\.pdf$/i, "") + "_text.txt")}><Download />Text file</Button>}
            </div>
          </div>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}