"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight, FileText, Grid2X2, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useThumbnails } from "@/components/layout/thumbnail-preference";
import { parsePdfPages } from "@/lib/pdf-pages";

const batchSize = 12;

type Props = {
  file: File | null;
  total: number;
  value: string;
  onChange: (value: string) => void;
  label: string;
  kind?: "single" | "multiple" | "ranges";
  disabled?: boolean;
  placeholder?: string;
  allowAnd?: boolean;
  ordered?: boolean;
  initialMode?: "click" | "type";
  onPageClick?: (page: number) => void;
};

export function PdfPagePicker(props: Props) {
  return <PagePicker key={props.file ? props.file.name + ":" + props.file.lastModified + ":" + props.file.size : ""} {...props} />;
}

function PagePicker({ file, total, value, onChange, label, kind = "multiple", disabled,
  placeholder, allowAnd, ordered = true, initialMode = "click", onPageClick }: Props) {
  const [mode, setMode] = useState<"click" | "type">(initialMode);
  const inputId = useId();
  const single = kind === "single";
  const inactive = disabled || !file || (single && total < 1);
  const ranges = kind === "ranges";

  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={mode === "type" ? inputId : undefined} id={inputId + "-label"} className="text-sm font-medium">{label}</label>
        <div role="group" aria-label={label + " selection mode"} className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-accent p-1">
          {([{ key: "click", text: "Click pages", icon: Grid2X2 }, { key: "type", text: single ? "Type number" : "Type range", icon: Keyboard }] as const).map(option => (
            <button key={option.key} type="button" aria-pressed={mode === option.key} disabled={disabled}
              className="flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold focus-visible:outline-2 aria-pressed:bg-card aria-pressed:shadow-xs disabled:opacity-60"
              onClick={() => setMode(option.key)}>
              <option.icon size={15} aria-hidden="true" />{option.text}
            </button>
          ))}
        </div>
      </div>
      {mode === "type" ? (
        <Input id={inputId} value={value} disabled={inactive} type={single ? "number" : "text"}
          min={single ? 1 : undefined} max={single ? total : undefined}
          placeholder={placeholder ?? (single ? "1" : "4, 1-3")}
          onChange={event => onChange(event.target.value.replace(/[–—]/g, "-"))} />
      ) : file && total > 0 ? (
        <PageGrid file={file} total={total} value={value} disabled={disabled} label={label} single={single}
          ranges={ranges} allowAnd={allowAnd} ordered={ordered} onChange={onChange} onPageClick={onPageClick} />
      ) : <p className="studio-empty">{file ? "Page previews are unavailable. Switch to typing to enter a selection." : "Choose a PDF to see its pages."}</p>}
    </div>
  );
}

function PageGrid({ file, total, value, label, single, ranges, disabled, allowAnd, ordered, onChange, onPageClick }: {
  file: File;
  total: number;
  value: string;
  label: string;
  single: boolean;
  ranges: boolean;
  disabled?: boolean;
  allowAnd?: boolean;
  ordered: boolean;
  onChange: (value: string) => void;
  onPageClick?: (page: number) => void;
}) {
  const [batch, setBatch] = useState(() => Math.floor((Math.max(1, Number(value.match(/^\s*\d+/)?.[0] ?? 1)) - 1) / batchSize));
  const [rangeStart, setRangeStart] = useState<number>();
  const lastBatch = Math.ceil(total / batchSize) - 1;
  const currentBatch = Math.min(batch, lastBatch);
  const start = currentBatch * batchSize + 1;
  const end = Math.min(start + batchSize - 1, total);
  const previews = usePagePreviews(file, start, end);
  const normalized = (allowAnd ? value.replace(/\bAND\b/gi, ",") : value).trim();
  let selected: number[] = [];
  let invalid = false;
  try {
    if (normalized) selected = parsePdfPages(normalized, total);
  } catch {
    invalid = true;
  }
  const order = new Map(selected.map((page, index) => [page, index + 1]));

  function selectPage(page: number) {
    if (single) {
      onChange(String(page));
      onPageClick?.(page);
    } else if (ranges) {
      if (rangeStart === undefined) setRangeStart(page);
      else addRange(page);
    } else {
      onChange((order.has(page) ? selected.filter(number => number !== page) : [...selected, page]).join(", "));
    }
  }

  function addRange(last: number) {
    if (rangeStart === undefined) return;
    const first = Math.min(rangeStart, last);
    const end = Math.max(rangeStart, last);
    const range = first === end ? String(first) : first + "-" + end;
    onChange([normalized, range].filter(Boolean).join(", "));
    setRangeStart(undefined);
  }

  return (
    <div className="space-y-2.5 rounded-xl border bg-background p-2.5 sm:p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Pages {start}–{end} of {total}</p>
        {lastBatch > 0 && <div className="inline-flex gap-1">
          <Button type="button" variant="outline" size="icon-sm" aria-label="Previous pages" disabled={disabled || currentBatch === 0} onClick={() => setBatch(currentBatch - 1)}><ChevronLeft /></Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Next pages" disabled={disabled || currentBatch === lastBatch} onClick={() => setBatch(currentBatch + 1)}><ChevronRight /></Button>
        </div>}
      </div>
      <div role="group" aria-label={label + " page tiles"} className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,4.25rem),1fr))] gap-2">
        {Array.from({ length: end - start + 1 }, (_, index) => {
          const page = start + index;
          const pressed = order.has(page) || rangeStart === page;
          const thumbnail = previews[page];
          return (
            <button key={page} type="button" aria-label={"Page " + page} aria-pressed={pressed} disabled={disabled || (invalid && !single)}
              className="relative grid min-w-0 justify-items-center gap-1 rounded-lg border bg-card p-1.5 text-xs font-medium focus-visible:outline-2 aria-pressed:border-primary aria-pressed:bg-accent disabled:opacity-60"
              onClick={() => selectPage(page)}>
              <span className="relative grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-sm bg-background">
                {thumbnail ? <Image src={thumbnail} alt="" fill unoptimized className="object-contain" /> : <FileText size={20} aria-hidden="true" className="text-muted-foreground" />}
              </span>
              {page}
              {pressed && <span className="absolute top-1 right-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] text-primary-foreground" aria-hidden="true">
                {single || ranges || !ordered ? <Check size={13} /> : order.get(page)}
              </span>}
            </button>
          );
        })}
      </div>
      {invalid ? <p role="status" className="text-xs text-destructive">The typed selection is outside the available pages or uses an invalid format.</p> :
        <p role="status" className="wrap-anywhere text-xs text-muted-foreground">{single ? (selected.length ? "Page " + selected[0] + " selected" : "Choose one page.") :
          ranges ? (rangeStart !== undefined ? "Choose the last page of the range." : normalized || "Click the first and last page of each range.") :
          selected.length ? selected.length + " selected · " + selected.slice(0, 12).join(", ") + (selected.length > 12 ? "…" : "") : (ordered ? "Click pages in the order you want." : "Click the pages you want.")}</p>}
      {!single && <div className="flex flex-wrap gap-2">
        {rangeStart !== undefined && <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => addRange(rangeStart)}>Add page {rangeStart}</Button>}
        {ranges && normalized && !invalid && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { onChange(normalized.split(",").slice(0, -1).join(",")); setRangeStart(undefined); }}>Undo last range</Button>}
        {(value || rangeStart !== undefined) && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { onChange(""); setRangeStart(undefined); }}>Clear selection</Button>}
      </div>}
    </div>
  );
}

function usePagePreviews(file: File, start: number, end: number) {
  const enabled = useThumbnails();
  const [previews, setPreviews] = useState<{ file: File; start: number; images: Record<number, string> }>();

  useEffect(() => {
    if (!enabled || file.size > 64 * 1024 * 1024) return;
    let cancelled = false;
    let release: (() => Promise<void>) | undefined;

    async function render() {
      const { openPdf, renderPdfCanvas } = await import("@/lib/pdf-render");
      if (cancelled) return;
      const task = await openPdf(file);
      let destroyed = false;
      release = async () => {
        if (destroyed) return;
        destroyed = true;
        await task.destroy();
      };
      try {
        if (cancelled) { void task.promise.catch(() => {}); return; }
        const pdf = await task.promise;
        const images: Record<number, string> = {};
        for (let number = start; number <= Math.min(end, pdf.numPages) && !cancelled; number++) {
          const page = await pdf.getPage(number);
          const { canvas } = await renderPdfCanvas(page, 144);
          try {
            images[number] = canvas.toDataURL("image/jpeg", 0.75);
          } finally {
            canvas.width = canvas.height = 0;
            page.cleanup();
          }
        }
        if (!cancelled) setPreviews({ file, start, images });
      } finally {
        await release();
      }
    }

    void render().catch(() => { /* Page buttons remain usable with icons. */ });
    return () => {
      cancelled = true;
      if (release) void release().catch(() => {});
    };
  }, [enabled, end, file, start]);

  return enabled && previews?.file === file && previews.start === start ? previews.images : {};
}
