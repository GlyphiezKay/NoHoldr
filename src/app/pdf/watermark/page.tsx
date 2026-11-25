"use client";

import { PdfPagePicker } from "@/components/pdf/pdf-page-picker";
import { useState, useCallback } from "react";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolWorkspace, ToolPanel } from "@/components/layout/tool-workspace";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { ToolFile } from "@/components/layout/tool-file";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Type } from "lucide-react";
import { parsePdfPages } from "@/lib/pdf-pages";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { pdfBytesToBlob } from "@/lib/pdf-utils";

export default function WatermarkPDFPage() {
    const [file, setFile] = useState<File | null>(null);
    const output = useToolExport(file);
    const [pageCount, setPageCount] = useState(0);
    const [selection, setSelection] = useState("");
    const [text, setText] = useState("CONFIDENTIAL");
    const [opacity, setOpacity] = useState([30]);
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

    const addWatermark = async () => {
        if (!file || !text.trim()) return;
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
        const font = await pdf.embedFont(StandardFonts.HelveticaBold);
        setProgress(40);

        const alpha = opacity[0] / 100;

        for (const [index, number] of selected.entries()) {
            setProgress(40 + Math.round((index / selected.length) * 40));
            const page = pdf.getPage(number - 1);
            const { width, height } = page.getSize();
            const fontSize = Math.min(width, height) / 10;
            const textWidth = font.widthOfTextAtSize(text, fontSize);

            page.drawText(text, {
                x: (width - textWidth) / 2,
                y: height / 2,
                size: fontSize,
                font,
                color: rgb(0.5, 0.5, 0.5),
                opacity: alpha,
                rotate: degrees(-45),
            });
        }

        setProgress(90);
        const bytes = await pdf.save();
        output.save(pdfBytesToBlob(bytes), file.name.replace(".pdf", "_watermarked.pdf"));

        setProgress(100);
        setTimeout(() => { setIsProcessing(false); setProgress(0); }, 1000);
    };

    return (
        <ToolWorkspace category="PDF tools" backHref="/pdf" title="Add Watermark" description="Place a text watermark on the pages of your PDF.">
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
                                label="Pages to watermark" placeholder="All pages" ordered={false} initialMode="type" disabled={isProcessing} />
                            <p className="mt-2 text-xs text-muted-foreground">Leave empty to use all pages.</p>
                            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
                        </div>



                        <div className="border rounded-xl p-4 mb-4 space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">Watermark Text</label>
                                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="CONFIDENTIAL" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-medium">Opacity</label>
                                    <span className="text-sm">{opacity[0]}%</span>
                                </div>
                                <Slider value={opacity} onValueChange={setOpacity} min={10} max={80} step={5} />
                            </div>
                        </div>

                        {isProcessing && <Progress value={progress} className="h-1.5 mb-4" />}

                        <Button onClick={addWatermark} disabled={isProcessing || !text.trim()} className="w-full h-11">
                            <Type className="h-4 w-4 mr-2" />Add Watermark & Download
                        </Button>
                    </ToolPanel>
                )}

                <ToolOutput file={output.file} />
            </div>
        </ToolWorkspace>
    );
}
