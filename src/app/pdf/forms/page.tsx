"use client";

import { PdfPagePicker } from "@/components/pdf/pdf-page-picker";
import { ToolFile } from "@/components/layout/tool-file";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { useState } from "react";
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFName, PDFOptionList, PDFRadioGroup, PDFTextField } from "pdf-lib";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { pdfBytesToBlob } from "@/lib/pdf-utils";

type Field = { name: string; kind: "text" | "check" | "dropdown" | "list" | "radio" | "other"; value: string; options?: string[] };
function fieldsOf(doc: PDFDocument): Field[] {
  return doc.getForm().getFields().map(field => {
    const name = field.getName();
    if (field instanceof PDFTextField) return { name, kind: "text", value: field.getText() ?? "" };
    if (field instanceof PDFCheckBox) return { name, kind: "check", value: field.isChecked() ? "yes" : "" };
    if (field instanceof PDFDropdown) return { name, kind: "dropdown", value: field.getSelected()[0] ?? "", options: field.getOptions() };
    if (field instanceof PDFOptionList) return { name, kind: "list", value: JSON.stringify(field.getSelected()), options: field.getOptions() };
    if (field instanceof PDFRadioGroup) return { name, kind: "radio", value: field.getSelected() ?? "", options: field.getOptions() };
    return { name, kind: "other", value: "" };
  });
}

type NewField = { name: string; kind: "text" | "check" | "dropdown"; page: number; options: string[]; x: number; y: number; width: number; height: number };

export default function PdfForms() {
  const [source, setSource] = useState<{ file: File; pages: number } | null>(null);
  const output = useToolExport(source);
  const [fields, setFields] = useState<Field[]>([]);
  const [newFields, setNewFields] = useState<NewField[]>([]);
  const [draft, setDraft] = useState({ name: "", kind: "text" as NewField["kind"], page: "1", options: "", x: "36", y: "36", width: "180", height: "24" });
  const [flatten, setFlatten] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function read(files: File[]) {
    if (files.length !== 1) { setError("Choose one PDF."); return; }
    setBusy(true);
    setError("");
    try {
      const doc = await PDFDocument.load(await files[0].arrayBuffer(), { updateMetadata: false });
      if (doc.catalog.getAcroForm()?.dict.has(PDFName.of("XFA"))) { setError("This PDF uses XFA forms. Choose a PDF with standard AcroForm fields."); return; }
      setFields(fieldsOf(doc));
      setNewFields([]);
      setSource({ file: files[0], pages: doc.getPageCount() });
    } catch {
      setError("Could not read this PDF or its form fields.");
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const name = draft.name.trim();
    const page = Number(draft.page), x = Number(draft.x), y = Number(draft.y);
    const width = Number(draft.width), height = Number(draft.height);
    if (!name || !source || !Number.isInteger(page) || page < 1 || page > source.pages ||
        ![x, y, width, height].every(Number.isFinite) || Math.min(x, y) < 0 || width <= 0 || height <= 0 ||
        [draft.x, draft.y].some(value => value === "")) {
      setError("Enter a field name, valid page number, and positive field dimensions.");
      return;
    }
    if ([...fields, ...newFields].some(field => field.name === name || field.name.startsWith(name + ".") || name.startsWith(field.name + "."))) {
      setError("Use a unique field name.");
      return;
    }
    const options = [...new Set(draft.options.split(",").map(option => option.trim()).filter(Boolean))];
    if (draft.kind === "dropdown" && options.length < 2) { setError("Enter at least two distinct dropdown options."); return; }
    setError("");
    setNewFields(items => [...items, { name, kind: draft.kind, page, options, x, y, width, height }]);
    setDraft(current => ({ ...current, name: "" }));
  }

  async function save() {
    if (!source || busy) return;
    setBusy(true);
    setError("");
    try {
      const doc = await PDFDocument.load(await source.file.arrayBuffer(), { updateMetadata: false });
      const form = doc.getForm();
      for (const { name, kind, value } of fields) {
        const field = form.getField(name);
        if (kind === "text" && field instanceof PDFTextField && (field.getText() ?? "") !== value) field.setText(value);
        if (kind === "check" && field instanceof PDFCheckBox) {
          if (value) field.check();
          else field.uncheck();
        }
        if ((kind === "dropdown" || kind === "radio") && (field instanceof PDFDropdown || field instanceof PDFRadioGroup)) {
          if (value) field.select(value);
          else field.clear();
        }
        if (kind === "list" && field instanceof PDFOptionList) {
          const selected: string[] = JSON.parse(value);
          if (selected.length) field.select(selected);
          else field.clear();
        }
      }
      for (const field of newFields) {
        const page = doc.getPage(field.page - 1);
        if (page.getRotation().angle % 360 !== 0) throw new Error("Rotate page " + field.page + " to the document’s base orientation before adding fields.");
        const { x, y, width, height } = page.getCropBox();
        if (field.x + field.width > width || field.y + field.height > height) throw new Error("Field “" + field.name + "” is outside the visible page.");
        const position = { x: x + field.x, y: y + height - field.y - field.height, width: field.width, height: field.height };
        if (field.kind === "text") form.createTextField(field.name).addToPage(page, position);
        if (field.kind === "check") form.createCheckBox(field.name).addToPage(page, position);
        if (field.kind === "dropdown") {
          const dropdown = form.createDropdown(field.name);
          dropdown.addOptions(field.options);
          dropdown.addToPage(page, position);
        }
      }
      if (flatten) form.flatten();
      output.save(pdfBytesToBlob(await doc.save()), source.file.name.replace(/\.pdf$/i, "") + (flatten ? "_flattened.pdf" : "_form.pdf"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the form.");
    } finally {
      setBusy(false);
    }
  }

  function change(index: number, value: string) {
    setFields(current => current.map((field, row) => row === index ? { ...field, value } : field));
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title="PDF Forms" description="Fill existing AcroForms or add new fillable controls.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <ToolPanel stage="input" title="Source PDF">
          {source && <div className="mb-3"><ToolFile blob={source.file} name={source.file.name} detail={source.pages + " pages"} /></div>}
            <FilePicker accept=".pdf,application/pdf" action={source ? "Replace PDF" : "Choose PDF"} hint="Or drop your PDF here." disabled={busy} onFiles={read} />
          </ToolPanel>
          {source && <ToolPanel title="Existing fields" description={fields.length ? "Edit values before exporting." : "No AcroForm fields found."}>
            <fieldset disabled={busy} className="min-w-0 space-y-3">
              {fields.map((field, index) => <label key={field.name} className="block break-all text-sm font-medium">
                {field.name}
                {field.kind === "text" && <Input className="mt-1" value={field.value} onChange={event => change(index, event.target.value)} />}
                {field.kind === "check" && <input type="checkbox" className="ml-2 accent-primary" checked={field.value === "yes"} onChange={event => change(index, event.target.checked ? "yes" : "")} />}
                {(field.kind === "dropdown" || field.kind === "radio" || field.kind === "list") &&
                  <select multiple={field.kind === "list"} className="mt-1 block min-h-9 w-full rounded border bg-background px-2"
                    value={field.kind === "list" ? JSON.parse(field.value) : field.value}
                    onChange={event => change(index, field.kind === "list" ? JSON.stringify(Array.from(event.target.selectedOptions, option => option.value)) : event.target.value)}>
                    {field.kind !== "list" && <option value="">No selection</option>}
                    {field.options?.map(option => <option key={option}>{option}</option>)}
                  </select>}
                {field.kind === "other" && <span className="ml-2 font-normal text-muted-foreground">Unchanged</span>}
              </label>)}
            </fieldset>
          </ToolPanel>}
        </div>
        <ToolPanel stage="settings" title="Create a field" description="Position fields in points from the top-left of an unrotated page.">
          <fieldset disabled={!source || busy} className="space-y-3">
            <label className="block text-sm font-medium">Field name<Input className="mt-1" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
            <label className="block text-sm font-medium">Field type
              <select className="mt-1 block h-9 w-full rounded border bg-background px-2" value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as NewField["kind"] })}>
                <option value="text">Text field</option><option value="check">Checkbox</option><option value="dropdown">Dropdown</option>
              </select>
            </label>
            {draft.kind === "dropdown" && <label className="block text-sm font-medium">Options, separated by commas<Input className="mt-1" value={draft.options} onChange={event => setDraft({ ...draft, options: event.target.value })} /></label>}
            <PdfPagePicker file={source?.file ?? null} total={source?.pages ?? 0} value={draft.page} label="Page"
              kind="single" onChange={page => setDraft(current => ({ ...current, page }))} disabled={busy} />
            <div className="grid grid-cols-2 gap-2">
              {(["x", "y", "width", "height"] as const).map(key => <label key={key} className="block text-sm font-medium capitalize">{key}
                <Input type="number" className="mt-1" value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} />
              </label>)}
            </div>
            <Button variant="outline" onClick={add}>Add field</Button>
          </fieldset>
          {newFields.length > 0 && <ul className="mt-4 space-y-2">{newFields.map(field => <li key={field.name} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
            <span className="wrap-anywhere">{field.name} · Page {field.page}</span>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setNewFields(items => items.filter(item => item.name !== field.name))}>Remove</Button>
          </li>)}</ul>}
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={flatten} disabled={!source || busy} onChange={event => setFlatten(event.target.checked)} /> Flatten fields in the exported copy</label>
          <Button className="mt-4 w-full" disabled={!source || busy || (!fields.length && !newFields.length)} onClick={save}>Save and download</Button>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
        <ToolOutput file={output.file} />
      </div>
    </ToolWorkspace>
  );
}
