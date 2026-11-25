"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolFile } from "@/components/layout/tool-file";
import { EmptyOutput } from "@/components/layout/tool-output";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { parseCSV, type CSVData } from "@/lib/csv-utils";
import { downloadFile } from "@/lib/download-manager";
import { fileStem } from "@/lib/file-utilities";

const pageSize = 50;

export default function CSVViewerPage() {
  const [source, setSource] = useState<{ file: File; data: CSVData }>();
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = page * pageSize;
  const total = source?.data.rows.length ?? 0;

  async function choose(files: File[]) {
    setBusy(true);
    setError("");
    setSource(undefined);
    setPage(0);
    try {
      const file = files[0];
      const data = parseCSV(await file.text());
      if (!data.headers.length) throw new Error("The CSV is empty.");
      setSource({ file, data });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read this CSV.");
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    if (!source) return;
    const { data, file } = source;
    const rows = data.rows.map(row => Object.fromEntries(data.headers.map((header, index) => [header, row[index]])));
    downloadFile(new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" }), fileStem(file.name) + ".json");
  }

  return (
    <ToolWorkspace category="Data tools" backHref="/data" title="CSV Viewer" description="Inspect CSV rows and export them as JSON.">
      <div className="grid min-w-0 gap-5">
        <ToolPanel stage="input" title="Source CSV">
          {source && <div className="mb-3"><ToolFile blob={source.file} name={source.file.name} detail={total + " rows · " + source.data.headers.length + " columns"} /></div>}
          <FilePicker accept=".csv,text/csv" disabled={busy} action={source ? "Replace CSV" : "Choose CSV"} hint="Or drop a comma-separated file here." onFiles={choose} />
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        </ToolPanel>
        <ToolPanel stage="result" title="CSV rows" action={source && <Button variant="outline" onClick={exportJson}><Download />Download JSON</Button>}>
          {source ? <>
            <div className="w-full overflow-x-auto rounded-lg border">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-accent"><tr>{source.data.headers.map((label, index) => <th className="px-3 py-2" scope="col" key={index}>{label}</th>)}</tr></thead>
                <tbody className="divide-y">{source.data.rows.slice(start, start + pageSize).map((row, index) => <tr className="even:bg-background" key={start + index}>
                  {row.map((cell, index) => <td className="min-w-24 max-w-96 wrap-anywhere whitespace-pre-wrap px-3 py-2" key={index}>{cell}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p role="status" className="text-sm text-muted-foreground">{total ? `Rows ${start + 1}–${Math.min(total, start + pageSize)} of ${total}` : "This CSV contains headers only."}</p>
              {total > pageSize && <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={start + pageSize >= total} onClick={() => setPage(current => current + 1)}>Next</Button>
              </div>}
            </div>
          </> : <EmptyOutput>Choose a CSV file to see its rows.</EmptyOutput>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
