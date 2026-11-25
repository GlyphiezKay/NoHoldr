"use client";

import { PdfPagePicker } from "@/components/pdf/pdf-page-picker";
import { useState, useCallback } from "react";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolWorkspace, ToolPanel } from "@/components/layout/tool-workspace";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { ToolFile } from "@/components/layout/tool-file";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, RotateCw, RotateCcw } from "lucide-react";
import { parsePdfPages } from "@/lib/pdf-pages";
import { PDFDocument, degrees } from "pdf-lib";
import { pdfBytesToBlob } from "@/lib/pdf-utils";

export default function RotatePDFPage() {
    const [file, setFile] = useState<File | null>(null);
    const output = useToolExport(file);
    const [pageCount, setPageCount] = useState(0);
    const [selection, setSelection] = useState("");
    const [rotation, setRotation] = useState(90);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState("");

    const handleFile = useCallback(async (f: File) => {
        if (f.type !== "application/pdf") return;
        const pdf = await PDFDocument.load(await f.arrayBuffer());
        setFile(f);
        setPageCount(pdf.getPageCount());
        setSelection("");
    }, []);

    const rotate = async () => {
        if (!file) return;
        let selected: number[];
        try {
            selected = selection.trim() ? parsePdfPages(selection, pageCount) : Array.from({ length: pageCount }, (_, index) => index + 1);
            setError("");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Select valid pages.");
            return;
        }
        setIsProcessing(true);
        setProgress(20);

        const pdf = await PDFDocument.load(await file.arrayBuffer());
        setProgress(50);

        selected.forEach(number => {
            const page = pdf.getPage(number - 1);
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees(currentRotation + rotation));
        });

        setProgress(80);
        const bytes = await pdf.save();
        output.save(pdfBytesToBlob(bytes), file.name.replace(".pdf", "_rotated.pdf"));

        setProgress(100);
        setTimeout(() => { setIsProcessing(false); setProgress(0); }, 1000);
    };

    return (
        <ToolWorkspace category="PDF tools" backHref="/pdf" title="Rotate PDF" description="Rotate the pages and keep the original PDF unchanged.">
            <div className="mx-auto max-w-3xl space-y-4">
                {file && <ToolPanel stage="input" title="Source PDF" action={<Button variant="ghost" size="sm" disabled={isProcessing} onClick={() => setFile(null)}>Change</Button>}><ToolFile blob={file} name={file.name} detail={pageCount + " pages"} /></ToolPanel>}
                {!file ? (
                    <ToolPanel stage="input" title="Source PDF">
                        <FilePicker accept=".pdf,application/pdf" action="Choose PDF" hint="Or drop a PDF here."
                            onFiles={files => { if (files.length === 1) void handleFile(files[0]); }} />
                    </ToolPanel>
                ) : (
                    <ToolPanel stage="settings" title="Settings">
                        <div className="mb-4 rounded-xl border bg-card p-3">
                            <PdfPagePicker file={file} total={pageCount} value={selection} onChange={setSelection}
                                label="Pages to rotate" placeholder="All pages" ordered={false} initialMode="type" disabled={isProcessing} />
                            <p className="mt-2 text-xs text-muted-foreground">Leave empty to use all pages.</p>
                            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
                        </div>



                        <div className="border rounded-xl p-4 mb-4">
                            <label className="text-sm font-medium mb-3 block">Rotation</label>
                            <div className="flex gap-2">
                                {[90, 180, 270].map((deg) => (
                                    <Button
                                        key={deg}
                                        variant={rotation === deg ? "default" : "outline"}
                                        onClick={() => setRotation(deg)}
                                        className="flex-1"
                                    >
                                        {deg === 90 && <RotateCw className="h-4 w-4 mr-1" />}
                                        {deg === 270 && <RotateCcw className="h-4 w-4 mr-1" />}
                                        {deg}°
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {isProcessing && <Progress value={progress} className="h-1.5 mb-4" />}

                        <Button onClick={rotate} disabled={isProcessing} className="w-full h-11">
                            <Download className="h-4 w-4 mr-2" />Rotate & Download
                        </Button>
                    </ToolPanel>
                )}

                <ToolOutput file={output.file} />
            </div>
        </ToolWorkspace>
    );
}
