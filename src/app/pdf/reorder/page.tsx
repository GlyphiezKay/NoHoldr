"use client";

import { Input } from "@/components/ui/input";
import { parsePdfPages } from "@/lib/pdf-pages";
import { useState, useCallback, useEffect, useRef } from "react";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolWorkspace, ToolPanel } from "@/components/layout/tool-workspace";
import { useThumbnails } from "@/components/layout/thumbnail-preference";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { ToolFile } from "@/components/layout/tool-file";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, GripVertical, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { openPdf, renderPdfCanvas } from "@/lib/pdf-render";

interface PageItem {
    index: number;       // original page index (0-based)
    label: string;       // display label
}

export default function ReorderPagesPage() {
    const thumbnails = useThumbnails();
    const [file, setFile] = useState<File | null>(null);
    const output = useToolExport(file);
    const [editingOrder, setEditingOrder] = useState(false);
    const [orderInput, setOrderInput] = useState("");
    const [orderError, setOrderError] = useState("");
    const [pages, setPages] = useState<PageItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [reading, setReading] = useState(false);
    const [error, setError] = useState("");
    const [previews, setPreviews] = useState<{ file: File; pages: string[] }>();
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleFile = useCallback(async (source: File) => {
        setReading(true);
        setError("");
        try {
            const pdf = await PDFDocument.load(await source.arrayBuffer());
            setPages(pdf.getPageIndices().map(index => ({ index, label: `Page ${index + 1}` })));
            setFile(source);
            setEditingOrder(false);
            setOrderError("");
        } catch {
            setError("Could not read this PDF.");
        } finally {
            setReading(false);
        }
    }, []);

    useEffect(() => {
        if (!file || !thumbnails) return;
        const source = file;
        let cancelled = false;
        let close: (() => Promise<void>) | undefined;

        async function render() {
            const task = await openPdf(source);
            let destroyed = false;
            close = async () => {
                if (destroyed) return;
                destroyed = true;
                await task.destroy();
            };
            try {
                if (cancelled) { void task.promise.catch(() => {}); return; }
                const pdf = await task.promise;
                const images: string[] = [];
                for (let page = 1; page <= Math.min(pdf.numPages, 60) && !cancelled; page++) {
                    const item = await pdf.getPage(page);
                    const { canvas } = await renderPdfCanvas(item, 120);
                    try {
                        images.push(canvas.toDataURL("image/jpeg", 0.7));
                    } finally {
                        canvas.width = canvas.height = 0;
                    }
                }
                if (!cancelled) setPreviews({ file: source, pages: images });
            } finally {
                await close();
            }
        }

        void render().catch(() => { /* Page icons remain available. */ });
        return () => {
            cancelled = true;
            if (close) void close().catch(() => {});
        };
    }, [file, thumbnails]);

    // Drag-and-drop reorder
    const handleDragStart = (index: number) => {
        dragItem.current = index;
    };

    const handleDragEnter = (index: number) => {
        dragOverItem.current = index;
    };

    const handleDragEnd = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const copy = [...pages];
        const [removed] = copy.splice(dragItem.current, 1);
        copy.splice(dragOverItem.current, 0, removed);
        setPages(copy);
        dragItem.current = null;
        dragOverItem.current = null;
    };

    // Move page up/down
    const movePage = (from: number, to: number) => {
        if (to < 0 || to >= pages.length) return;
        const copy = [...pages];
        const [item] = copy.splice(from, 1);
        copy.splice(to, 0, item);
        setPages(copy);
    };

    // Reset to original order
    const resetOrder = () => {
        const sorted = [...pages].sort((a, b) => a.index - b.index);
        setPages(sorted);
        setOrderInput(sorted.map(item => item.index + 1).join(", "));
        setOrderError("");
    };

    function applyTypedOrder() {
        try {
            const numbers = orderInput.split(",").flatMap(segment => parsePdfPages(segment, pages.length));
            if (numbers.length !== pages.length || new Set(numbers).size !== pages.length) {
                throw new Error("Include every page exactly once in the new order.");
            }
            const pagesByNumber = new Map(pages.map(page => [page.index + 1, page]));
            setPages(numbers.map(number => pagesByNumber.get(number)!));
            setEditingOrder(false);
            setOrderError("");
        } catch (reason) {
            setOrderError(reason instanceof Error ? reason.message : "Could not apply the page order.");
        }
    }

    // Check if order changed
    const hasChanges = pages.some((p, i) => p.index !== i);

    const handleReorder = async () => {
        if (!file || !hasChanges) return;
        setIsProcessing(true);
        setProgress(10);
        setStatusText("Loading PDF...");

        try {
            const source = await PDFDocument.load(await file.arrayBuffer());
            setProgress(30);
            setStatusText("Re-ordering pages...");

            const newDoc = await PDFDocument.create();
            const newOrder = pages.map((p) => p.index);

            const copiedPages = await newDoc.copyPages(source, newOrder);
            copiedPages.forEach((page) => newDoc.addPage(page));

            setProgress(80);
            setStatusText("Saving...");

            const bytes = await newDoc.save();
            const blob = new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: "application/pdf" });
            output.save(blob, file.name.replace(/\.pdf$/i, "_reordered.pdf"));

            setProgress(100);
            setStatusText("Done!");
            setTimeout(() => {
                setIsProcessing(false);
                setProgress(0);
                setStatusText("");
            }, 800);
        } catch (err) {
            console.error("Reorder failed:", err);
            setIsProcessing(false);
            setProgress(0);
            setStatusText("");
        }
    };

    return (
        <ToolWorkspace category="PDF tools" backHref="/pdf" title="Reorder Pages" description="Rearrange your PDF with drag and drop or move buttons.">
            <div className="mx-auto max-w-3xl space-y-4">
                {file && <ToolPanel stage="input" title="Source PDF" action={
                    <div className="flex flex-wrap gap-2">
                        {hasChanges && <Button variant="ghost" size="sm" disabled={isProcessing} onClick={resetOrder}><RotateCcw />Reset</Button>}
                        <Button variant="ghost" size="sm" disabled={isProcessing} onClick={() => { setFile(null); setPages([]); }}>Change</Button>
                    </div>
                }>
                    <ToolFile blob={file} name={file.name} detail={pages.length + " pages"} />
                </ToolPanel>}
                {!file ? (
                    <ToolPanel stage="input" title="Source PDF">
                        <FilePicker accept=".pdf,application/pdf" action="Choose PDF" hint="Or drop a PDF here." disabled={reading}
                            onFiles={files => { if (files.length === 1) void handleFile(files[0]); }} />
                    </ToolPanel>
                ) : (
                    <ToolPanel stage="settings" title="Settings">
                        <div role="group" aria-label="Page order mode" className="mb-3 flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant={editingOrder ? "outline" : "default"} aria-pressed={!editingOrder}
                                disabled={isProcessing} onClick={() => setEditingOrder(false)}>Click or drag pages</Button>
                            <Button type="button" size="sm" variant={editingOrder ? "default" : "outline"} aria-pressed={editingOrder}
                                disabled={isProcessing} onClick={() => {
                                    if (!editingOrder) setOrderInput(pages.map(item => item.index + 1).join(", "));
                                    setOrderError("");
                                    setEditingOrder(true);
                                }}>Type order</Button>
                        </div>
                        {editingOrder && <form className="mb-4 space-y-2 rounded-lg border bg-background p-3" onSubmit={event => { event.preventDefault(); applyTypedOrder(); }}>
                            <label className="block text-sm font-medium">New page order
                                <Input className="mt-2" value={orderInput} onChange={event => { setOrderInput(event.target.value.replace(/[–—]/g, "-")); setOrderError(""); }} />
                            </label>
                            <p className="text-xs text-muted-foreground">Include every original page, for example 4, 1–3.</p>
                            <Button type="submit" variant="outline" size="sm">Apply order</Button>
                            {orderError && <p role="alert" className="text-sm text-destructive">{orderError}</p>}
                        </form>}
                        {/* Sortable page list */}
                        {pages.length > 0 && !reading && !editingOrder && (
                            <div className="border rounded-xl overflow-hidden mb-4">
                                <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                                    {pages.map((page, i) => (
                                        <div
                                            key={`${page.index}-${i}`}
                                            className="flex items-center gap-3 p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors cursor-grab active:cursor-grabbing"
                                            draggable={!isProcessing}
                                            onDragStart={() => handleDragStart(i)}
                                            onDragEnter={() => handleDragEnter(i)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => e.preventDefault()}
                                        >
                                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

                                            {thumbnails && previews?.file === file && previews.pages[page.index] ? (
                                                // eslint-disable-next-line @next/next/no-img-element -- Local file previews stay in the browser.
                                                <img
                                                    src={previews.pages[page.index]}
                                                    alt={page.label}
                                                    className="h-16 w-12 object-cover rounded border bg-white shrink-0"
                                                />
                                            ) : <FileText className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />}

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">{page.label}</p>
                                                {page.index !== i && (
                                                    <p className="text-xs text-blue-600 dark:text-blue-400">
                                                        Originally page {page.index + 1} → now position {i + 1}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex gap-0.5 shrink-0">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={"Move " + page.label + " up"} onClick={() => movePage(i, i - 1)} disabled={isProcessing || i === 0}>
                                                    <ArrowUp className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={"Move " + page.label + " down"} onClick={() => movePage(i, i + 1)} disabled={isProcessing || i === pages.length - 1}>
                                                    <ArrowDown className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Progress */}
                        {isProcessing && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>{statusText}</span>
                                    <span>{progress}%</span>
                                </div>
                                <Progress value={progress} className="h-1.5" />
                            </div>
                        )}

                        {/* Action */}
                        <Button onClick={handleReorder} disabled={isProcessing || !hasChanges || editingOrder} className="w-full h-11">
                            <Download className="h-4 w-4 mr-2" />
                            {hasChanges ? "Save Re-ordered PDF" : "Drag pages to re-order"}
                        </Button>
                    </ToolPanel>
                )}

                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <ToolOutput file={output.file} />
            </div>
        </ToolWorkspace>
    );
}
