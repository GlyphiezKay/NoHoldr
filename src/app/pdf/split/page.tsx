"use client";

import { PdfPagePicker } from "@/components/pdf/pdf-page-picker";
import { useState } from "react";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolWorkspace, ToolPanel } from "@/components/layout/tool-workspace";
import { EmptyOutput } from "@/components/layout/tool-output";
import { ToolFile } from "@/components/layout/tool-file";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Download } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { parsePdfPages } from "@/lib/pdf-pages";
import { downloadFile } from "@/lib/download-manager";

type Mode = "range" | "extract" | "every";

interface SplitResult {
    name: string;
    blob: Blob;
}

export default function SplitPDFPage() {
    const [file, setFile] = useState<File | null>(null);
    const [pageCount, setPageCount] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("");
    const [mode, setMode] = useState<Mode>("range");
    const [rangeInput, setRangeInput] = useState("");
    const [extractInput, setExtractInput] = useState("");
    const [everyN, setEveryN] = useState("5");
    const [splitResults, setSplitResults] = useState<SplitResult[]>([]);


    const loadPdf = async (f: File) => {
        try {
            const pdf = await PDFDocument.load(await f.arrayBuffer());
            setFile(f);
            setSplitResults([]);
            setPageCount(pdf.getPageCount());
            setRangeInput("");
            setExtractInput("");
        } catch { /* ignore */ }
    };

    const parseRanges = (input: string) => input.trim()
        ? input.split(",").map(segment => parsePdfPages(segment, pageCount).map(page => page - 1))
        : [];

    const handleSplit = async () => {
        if (!file) return;
        setIsProcessing(true);
        setProgress(0);
        setStatus("Splitting...");

        try {
            const source = await PDFDocument.load(await file.arrayBuffer());
            const base = file.name.replace(".pdf", "");
            const results: SplitResult[] = [];

            if (mode === "range") {
                const ranges = parseRanges(rangeInput);
                if (ranges.length === 0) { setStatus("Invalid range"); setIsProcessing(false); return; }
                for (let i = 0; i < ranges.length; i++) {
                    setProgress(Math.round((i / ranges.length) * 90));
                    const doc = await PDFDocument.create();
                    const pages = await doc.copyPages(source, ranges[i]);
                    pages.forEach(p => doc.addPage(p));
                    const pdfBytes = await doc.save();
                    results.push({ name: `${base}_part${i + 1}.pdf`, blob: new Blob([new Uint8Array(pdfBytes).buffer as ArrayBuffer], { type: "application/pdf" }) });
                }
            } else if (mode === "extract") {
                const nums = parseRanges(extractInput).flat();
                if (nums.length === 0) { setStatus("Invalid pages"); setIsProcessing(false); return; }
                setProgress(50);
                const doc = await PDFDocument.create();
                const pages = await doc.copyPages(source, nums);
                pages.forEach(p => doc.addPage(p));
                const pdfBytes = await doc.save();
                results.push({ name: `${base}_extracted.pdf`, blob: new Blob([new Uint8Array(pdfBytes).buffer as ArrayBuffer], { type: "application/pdf" }) });
            } else {
                const n = parseInt(everyN, 10);
                if (isNaN(n) || n < 1) { setStatus("Invalid number"); setIsProcessing(false); return; }
                const parts = Math.ceil(pageCount / n);
                for (let i = 0; i < parts; i++) {
                    setProgress(Math.round((i / parts) * 90));
                    const indices = Array.from({ length: Math.min(n, pageCount - i * n) }, (_, j) => i * n + j);
                    const doc = await PDFDocument.create();
                    const pages = await doc.copyPages(source, indices);
                    pages.forEach(p => doc.addPage(p));
                    const pdfBytes = await doc.save();
                    results.push({ name: `${base}_part${i + 1}.pdf`, blob: new Blob([new Uint8Array(pdfBytes).buffer as ArrayBuffer], { type: "application/pdf" }) });
                }
            }

            setSplitResults(results);
            setProgress(100);
            setStatus("Done!");
            setTimeout(() => { setIsProcessing(false); setProgress(0); setStatus(""); }, 1000);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Could not split this PDF.");
            setIsProcessing(false);
        }
    };

    return (
        <ToolWorkspace category="PDF tools" backHref="/pdf" title="Split PDF" description="Export a page range or split a PDF into several files.">
            <div className="mx-auto max-w-3xl space-y-4">
                {file && <ToolPanel stage="input" title="Source PDF" action={<Button variant="ghost" size="sm" disabled={isProcessing} onClick={() => { setFile(null); setSplitResults([]); }}>Change</Button>}><ToolFile blob={file} name={file.name} detail={pageCount + " pages"} /></ToolPanel>}
                {!file ? (
                    <ToolPanel stage="input" title="Source PDF">
                        <FilePicker accept=".pdf,application/pdf" action="Choose PDF" hint="Or drop a PDF here."
                            onFiles={files => { if (files.length === 1) void loadPdf(files[0]); }} />
                    </ToolPanel>
                ) : (
                    <>
                        {/* File Info */}


                        {/* Mode Tabs */}
                        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-4">
                            {(["range", "extract", "every"] as Mode[]).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors ${mode === m ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                                >
                                    {m === "range" ? "Ranges" : m === "extract" ? "Extract" : "Every N"}
                                </button>
                            ))}
                        </div>

                        {/* Mode Content */}
                        <div className="border rounded-xl p-4 mb-4">
                            {mode === "range" && (
                                <div>
                                    <PdfPagePicker file={file} total={pageCount} value={rangeInput} onChange={setRangeInput}
                                        label="Page ranges" kind="ranges" disabled={isProcessing} />
                                    <p className="text-xs text-muted-foreground mt-1">Each range → separate PDF</p>
                                </div>
                            )}
                            {mode === "extract" && (
                                <div>
                                    <PdfPagePicker file={file} total={pageCount} value={extractInput} onChange={setExtractInput}
                                        label="Pages to extract" disabled={isProcessing} />
                                    <p className="text-xs text-muted-foreground mt-1">Combined into one PDF</p>
                                </div>
                            )}
                            {mode === "every" && (
                                <div>
                                    <label className="text-sm font-medium">Split every N pages</label>
                                    <Input type="number" min="1" value={everyN} onChange={e => setEveryN(e.target.value)} className="mt-1 w-24" />
                                    <p className="text-xs text-muted-foreground mt-1">{Math.ceil(pageCount / (parseInt(everyN) || 1))} files</p>
                                </div>
                            )}
                        </div>

                        {/* Progress */}
                        {isProcessing && (
                            <div className="border rounded-xl p-4 mb-4">
                                <div className="flex justify-between text-sm mb-2"><span>{status}</span><span>{progress}%</span></div>
                                <Progress value={progress} className="h-1.5" />
                            </div>
                        )}

                        {/* Action */}
                        {splitResults.length === 0 ? (
                            <Button onClick={handleSplit} disabled={isProcessing} className="w-full h-11">
                                <Download className="h-4 w-4 mr-2" />Split PDF
                            </Button>
                        ) : (
                            <ToolPanel stage="result" title="Results">
                                {splitResults.length > 1 && (
                                    <Button onClick={async () => {
                                        const { downloadAsZip } = await import("@/lib/download-manager");
                                        await downloadAsZip(splitResults, `${file.name.replace(".pdf", "")}_split.zip`);
                                    }} className="w-full h-11">
                                        <Download className="h-4 w-4 mr-2" />Download as ZIP ({splitResults.length} files)
                                    </Button>
                                )}
                                {splitResults.map((item, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="min-w-0 flex-1"><ToolFile blob={item.blob} name={item.name} /></div>
                                        <Button size="icon" variant="outline" aria-label={"Download " + item.name} onClick={() => downloadFile(item.blob, item.name)}><Download /></Button>
                                    </div>
                                ))}
                                <Button variant="ghost" onClick={() => { setSplitResults([]); }} className="w-full">
                                    Split Again
                                </Button>
                            </ToolPanel>
                        )}
                    </>
                )}

                {!splitResults.length && <ToolPanel stage="result" title="Results"><EmptyOutput /></ToolPanel>}
            </div>
        </ToolWorkspace>
    );
}
