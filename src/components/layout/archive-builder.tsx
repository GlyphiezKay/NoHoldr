"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ToolFile } from "@/components/layout/tool-file";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { createFileZip, fileStem, safeFileName, uniqueFileName } from "@/lib/file-utilities";

export function ArchiveBuilder({ rename = false }: { rename?: boolean }) {
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [archiveName, setArchiveName] = useState(rename ? "renamed_files" : "archive");
  const [rules, setRules] = useState({ Prefix: "", Suffix: "", Find: "", "Replace with": "" });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const output = useToolExport(files);
  const seen = new Set<string>();
  const entries = files.map(({ file }) => {
    const stem = fileStem(file.name);
    const changed = rules.Find ? stem.replaceAll(rules.Find, rules["Replace with"]) : stem;
    const name = rename ? rules.Prefix + changed + rules.Suffix + file.name.slice(stem.length) : file.name;
    return { name: uniqueFileName(name, seen), blob: file };
  });

  async function build() {
    if (!entries.length || busy) return;
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const basename = safeFileName(archiveName.replace(/\.zip$/i, ""));
      output.save(await createFileZip(entries, setProgress), basename + ".zip");
    } catch {
      setError("Could not create this ZIP. Try fewer or smaller files.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="Files tools" backHref="/files" title={rename ? "Batch Rename" : "Create ZIP"}
      description={rename ? "Preview names as you type, then package the renamed copies together." : "Bundle several files into a single archive directly in your browser."}>
      <div className="studio-flow">
        <ToolPanel stage="input" title="Source files" action={files.length > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setFiles([])}>Clear</Button>}>
          <FilePicker multiple disabled={busy} action={files.length ? "Add files" : "Choose files"} hint="Or drop one or more files here."
            onFiles={items => setFiles(current => [...current, ...items.map(file => ({ id: crypto.randomUUID(), file }))])} />
          {files.length > 0 && <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto">
            {files.map(({ id, file }, i) => <li key={id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1"><ToolFile blob={file} name={file.name} detail={entries[i].name !== file.name ? "ZIP entry: " + entries[i].name : undefined} /></div>
              <Button variant="ghost" size="icon" aria-label={"Remove " + file.name} disabled={busy} onClick={() => setFiles(current => current.filter(item => item.id !== id))}><X /></Button>
            </li>)}
          </ul>}
        </ToolPanel>
        <ToolPanel stage="settings" title={rename ? "Naming rules" : "Archive options"}>
          <fieldset disabled={busy} className="grid gap-3">
            {rename && <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(rules) as (keyof typeof rules)[]).map(label => <label key={label} className="text-sm font-medium">{label}
                <Input className="mt-1" value={rules[label]} onChange={event => setRules(current => ({ ...current, [label]: event.target.value }))} />
              </label>)}
            </div>}
            <label className="text-sm font-medium">ZIP name<Input className="mt-1" value={archiveName} onChange={event => setArchiveName(event.target.value)} /></label>
          </fieldset>
          {busy && <Progress value={progress} className="mt-3" aria-label="ZIP progress" />}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <Button className="mt-4 w-full" disabled={!files.length || busy || !archiveName.trim()} onClick={build}><Download />{rename ? "Download renamed ZIP" : "Create & Download ZIP"}</Button>
        </ToolPanel>
        <ToolOutput file={output.file} />
      </div>
    </ToolWorkspace>
  );
}
