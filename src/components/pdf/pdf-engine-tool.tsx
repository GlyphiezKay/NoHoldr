"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { EmptyOutput } from "@/components/layout/tool-output";
import { ToolFile } from "@/components/layout/tool-file";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { downloadFile, formatBytes } from "@/lib/download-manager";
import { runPdfEngine, type PdfEngineOperation } from "@/lib/pdf-engine";

const copy = {
  protect: { title: "Protect PDF", description: "Encrypt a PDF with AES-256 and require a password to open it.", label: "Encrypt PDF", suffix: "protected" },
  unlock: { title: "Unlock PDF", description: "Remove encryption from a PDF that you can open with its current password.", label: "Decrypt PDF", suffix: "unlocked" },
  repair: { title: "Repair PDF", description: "Attempt to rebuild a damaged PDF and check the structure of the recovered copy.", label: "Repair PDF", suffix: "repaired" },
} as const;

export function PdfEngineTool({ operation }: { operation: Exclude<PdfEngineOperation, "optimize"> }) {
  const text = copy[operation];
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; warnings: number } | null>(null);

  function select(files: File[]) {
    const source = files[0];
    if (files.length !== 1 || !source.size || !(/\.pdf$/i.test(source.name) || source.type === "application/pdf")) {
      setError("Choose one non-empty PDF.");
      return;
    }
    setFile(source);
    setPassword("");
    setConfirmation("");
    setResult(null);
    setError("");
  }

  async function process() {
    if (!file || busy) return;
    if (operation === "protect" && (!password.trim() || password !== confirmation || new TextEncoder().encode(password).length > 127)) {
      setError(password !== confirmation ? "The passwords do not match." : "Enter a non-blank password of up to 127 UTF-8 bytes.");
      return;
    }
    setBusy(true);
    setResult(null);
    setError("");
    try {
      setResult(await runPdfEngine(file, operation, password));
      setPassword("");
      setConfirmation("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The PDF operation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title={text.title} description={text.description}>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ToolPanel stage="input" title="Source PDF">
          {file && <div className="mb-3"><ToolFile blob={file} name={file.name} /></div>}
          <FilePicker accept=".pdf,application/pdf" action={file ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy} onFiles={select} />
        </ToolPanel>
        <ToolPanel stage="settings" title={operation === "repair" ? "Recovery" : "Password"}>
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); void process(); }}>
            {operation !== "repair" && <label className="block text-sm font-medium">
              {operation === "protect" ? "New password" : "Current password"}
              <Input type="password" autoComplete={operation === "protect" ? "new-password" : "current-password"} className="mt-2"
                disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
            </label>}
            {operation === "protect" && <label className="block text-sm font-medium">Confirm password
              <Input type="password" autoComplete="new-password" className="mt-2" disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
            </label>}
            {operation === "repair" && <p className="text-sm text-muted-foreground">Repair can rebuild missing or damaged references when the page data is still present.</p>}
            <Button type="submit" size="lg" className="w-full" disabled={!file || busy}>{busy ? "Processing PDF…" : text.label}</Button>
            {busy && <p role="status" className="text-sm text-muted-foreground">The local PDF engine is working.</p>}
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}

        </ToolPanel>
        <ToolPanel stage="result" title="Result">
          {result && file && <div className="mt-4 space-y-2 rounded-lg border bg-background p-3">
            <ToolFile blob={result.blob} name={file.name.replace(/\.pdf$/i, "") + "_" + text.suffix + ".pdf"} />
            <p role="status" className="text-sm">{formatBytes(result.blob.size)} · {result.warnings ? "Completed with structural warnings. Review the output." : "Ready to download."}</p>
            <Button variant="outline" onClick={() => downloadFile(result.blob, file.name.replace(/\.pdf$/i, "") + "_" + text.suffix + ".pdf")}><Download />Download PDF</Button>
          </div>}
          {!result && <EmptyOutput />}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}