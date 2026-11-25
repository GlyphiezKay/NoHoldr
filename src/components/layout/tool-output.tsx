"use client";

import { useState } from "react";
import { ArrowDownToLine, Download } from "lucide-react";
import { downloadFile } from "@/lib/download-manager";
import { Button } from "@/components/ui/button";
import { ToolFile } from "./tool-file";
import { ToolPanel } from "./tool-workspace";

type Output = { blob: Blob; name: string };
export function useToolExport<Source>(source: Source) {
  const [saved, setSaved] = useState<{ source: Source; file: Output }>();

  if (saved && saved.source !== source) setSaved(undefined);

  function save(blob: Blob, name: string) {
    setSaved({ source, file: { blob, name } });
    downloadFile(blob, name);
  }

  return { save, file: saved && saved.source === source ? saved.file : undefined };
}

export function EmptyOutput({ children = "Processed files will appear here." }: { children?: string }) {
  return <p className="studio-empty"><ArrowDownToLine size={20} aria-hidden="true" />{children}</p>;
}

export function ViewToolResult() {
  return (
    <a href="#tool-result" className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2">
      <ArrowDownToLine size={16} aria-hidden="true" />View result
    </a>
  );
}

export function ToolOutput({ file }: { file?: Output }) {
  return (
    <ToolPanel stage="result" title="Result">
      {file ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 basis-48"><ToolFile blob={file.blob} name={file.name} /></div>
          <Button variant="outline" onClick={() => downloadFile(file.blob, file.name)}><Download />Download again</Button>
        </div>
      ) : <EmptyOutput />}
    </ToolPanel>
  );
}
