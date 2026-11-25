"use client";

import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolFile } from "@/components/layout/tool-file";
import { EmptyOutput, ViewToolResult } from "@/components/layout/tool-output";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { csvToJSON, jsonToCSV } from "@/lib/csv-utils";
import { downloadFile } from "@/lib/download-manager";
import { fileStem } from "@/lib/file-utilities";

const formats = [
  { value: "txt", label: "Plain text", ext: "txt", mime: "text/plain" },
  { value: "html", label: "HTML", ext: "html", mime: "text/html" },
  { value: "md", label: "Markdown", ext: "md", mime: "text/markdown" },
  { value: "csv-from-json", label: "CSV", ext: "csv", mime: "text/csv" },
  { value: "json-from-csv", label: "JSON", ext: "json", mime: "application/json" },
  { value: "xml-from-json", label: "XML", ext: "xml", mime: "application/xml" },
] as const;

const escapeMarkup = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

function xml(value: unknown, name: string): string {
  const validName = /^[a-z_][a-z0-9_.-]*$/i.test(name);
  const tag = validName ? name : "entry";
  const attribute = validName ? "" : ' key="' + escapeMarkup(name) + '"';
  if (value === null) return "<" + tag + attribute + "/>";
  const content = Array.isArray(value) ? value.map(item => xml(item, "item")).join("") :
    typeof value === "object" && value ? Object.entries(value).map(([key, item]) => xml(item, key)).join("") :
    escapeMarkup(String(value));
  return "<" + tag + attribute + ">" + content + "</" + tag + ">";
}

export default function DocumentConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<(typeof formats)[number]["value"]>("txt");
  const [result, setResult] = useState<{ name: string; text: string; blob: Blob }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const extension = file?.name.split(".").at(-1)?.toLowerCase();
  const available = formats.filter((item, index) => index < 3 || (extension === "json" && item.value.endsWith("from-json")) || (extension === "csv" && item.value === "json-from-csv"));

  async function run() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setResult(undefined);
    setCopied(false);
    try {
      const input = await file.text();
      const option = available.find(item => item.value === format)!;
      let text = input;
      const stem = fileStem(file.name);
      if (format === "html") text = '<!doctype html><html lang="en"><meta charset="utf-8"><title>' + escapeMarkup(stem) + '</title><pre>' + escapeMarkup(input) + '</pre></html>';
      if (format === "csv-from-json") text = jsonToCSV(JSON.parse(input));
      if (format === "json-from-csv") text = JSON.stringify(csvToJSON(input), null, 2);
      if (format === "xml-from-json") text = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml(JSON.parse(input), "root");
      setResult({ name: stem + "." + option.ext, text, blob: new Blob([text], { type: option.mime + ";charset=utf-8" }) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not convert this document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="Convert tools" backHref="/convert" title="Document Converter" description="Convert text and structured data between compatible formats.">
      <div className="studio-flow">
        <ToolPanel stage="input" title="Source document">
          {file && <div className="mb-3"><ToolFile blob={file} name={file.name} /></div>}
          <FilePicker accept=".txt,.csv,.json,.xml,.md,.html,.htm,.tsv,.log" disabled={busy} action={file ? "Replace document" : "Choose document"}
            hint="Or drop a text, JSON, or CSV file here." onFiles={files => { setFile(files[0]); setFormat("txt"); setResult(undefined); setError(""); }} />
        </ToolPanel>
        <ToolPanel stage="settings" title="Output format">
          <label className="block text-sm font-medium">Format<select className="mt-1 block w-full rounded-lg border bg-background p-2" aria-label="Format" value={format}
            disabled={busy} onChange={event => setFormat(event.target.value as typeof format)}>
            {available.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select></label>
          <Button className="mt-4 w-full" disabled={!file || busy} onClick={run}>{busy ? "Converting…" : "Convert document"}</Button>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          {result && <ViewToolResult />}
        </ToolPanel>
        <ToolPanel stage="result" title="Converted document">
          {result ? <div className="space-y-3">
            <ToolFile blob={result.blob} name={result.name} />
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap wrap-anywhere rounded-lg border bg-background p-3 text-sm">{result.text.slice(0, 5000)}{result.text.length > 5000 && "\n…"}</pre>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => downloadFile(result.blob, result.name)}><Download />Download document</Button>
              <Button variant="outline" onClick={async () => {
                try { await navigator.clipboard.writeText(result.text); setCopied(true); }
                catch { setError("Could not access the clipboard."); }
              }}><Copy />{copied ? "Copied" : "Copy text"}</Button>
            </div>
          </div> : <EmptyOutput />}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
