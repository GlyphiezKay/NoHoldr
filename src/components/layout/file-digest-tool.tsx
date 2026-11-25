"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { EmptyOutput } from "@/components/layout/tool-output";
import { ToolFile } from "@/components/layout/tool-file";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { sha256 } from "@/lib/file-utilities";

type Digested = { file: File; hash: string };
export function FileDigestTool({ duplicates = false }: { duplicates?: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Digested[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const groups = new Map<string, File[]>();
  for (const { file, hash } of results) {
    const group = groups.get(hash);
    if (group) group.push(file);
    else groups.set(hash, [file]);
  }
  const matches = [...groups].filter(([, group]) => group.length > 1);

  async function run(source: File[]) {
    setFiles(source);
    setResults([]);
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const digests: Digested[] = [];
      for (const [index, file] of source.entries()) {
        setStatus(`Checking file ${index + 1} of ${source.length}…`);
        digests.push({ file, hash: await sha256(file) });
      }
      setResults(digests);
      setStatus("");
    } catch {
      setError("Could not read these files. Try a smaller batch.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="Files tools" backHref="/files" title={duplicates ? "Find Duplicates" : "File Hash (SHA-256)"}
      description={duplicates ? "Group files with identical content, even when the filenames differ." : "Calculate the SHA-256 checksum for each selected file."}>
      <div className="grid gap-5">
        <ToolPanel stage="input" title="Source files">
          <FilePicker multiple disabled={busy} action={files.length ? "Choose another batch" : "Choose files"} hint="Or drop files here." onFiles={run} />
          {files.length > 0 && <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {files.map((file, index) => <li key={index}><ToolFile blob={file} name={file.name} /></li>)}
          </ul>}
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
        <ToolPanel stage="result" title={duplicates ? "Duplicate groups" : "Checksums"}>
          {!results.length ? <EmptyOutput>Choose files to see results here.</EmptyOutput> : duplicates ? (
            matches.length ? <ul className="grid gap-3 sm:grid-cols-2">
              {matches.map(([hash, group]) => <li key={hash} className="rounded-xl border bg-background p-3">
                <p className="mb-1 font-medium">{group.length} identical files</p>
                {group.map((file, index) => <p className="wrap-anywhere text-sm" key={index}>{file.name}</p>)}
              </li>)}
            </ul> : <p role="status">No duplicates in {results.length} files.</p>
          ) : <ul className="divide-y">
            {results.map(({ file, hash }, index) => <li key={index} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0"><p className="wrap-anywhere text-sm font-medium">{file.name}</p><code className="wrap-anywhere text-xs">{hash}</code></div>
              <Button variant="ghost" size="icon" aria-label={"Copy checksum for " + file.name} onClick={async () => {
                try { await navigator.clipboard.writeText(hash); setStatus("Checksum copied."); }
                catch { setError("Could not access the clipboard."); }
              }}><Copy /></Button>
            </li>)}
          </ul>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
