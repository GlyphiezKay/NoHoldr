"use client";

import { PdfPagePicker } from "@/components/pdf/pdf-page-picker";
import { useState, useCallback } from "react";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolWorkspace, ToolPanel } from "@/components/layout/tool-workspace";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { ToolFile } from "@/components/layout/tool-file";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trash2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { parsePdfPages } from "@/lib/pdf-pages";
import { pdfBytesToBlob } from "@/lib/pdf-utils";

export default function RemovePagesPage() {
    const [file, setFile] = useState<File | null>(null);
    const output = useToolExport(file);
    const [pageCount, setPageCount] = useState(0);
    const [pagesToRemove, setPagesToRemove] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFile = useCallback(async (f: File) => {
        if (f.type !== "application/pdf") return;
        const pdf = await PDFDocument.load(await f.arrayBuffer());
        setFile(f);
        setPageCount(pdf.getPageCount());
        setPagesToRemove("");
    }, []);

    const parsePages = () => {
        try {
            return pagesToRemove.trim() ? parsePdfPages(pagesToRemove, pageCount) : [];
        } catch {
            return [];
        }
    };

    const removePages = async () => {
        if (!file) return;
        const toRemove = parsePages();
        if (toRemove.length === 0 || toRemove.length === pageCount) return;

        setIsProcessing(true);
        setProgress(20);

        const pdf = await PDFDocument.load(await file.arrayBuffer());
        setProgress(50);

        // Remove pages in reverse order
        for (const page of toRemove.sort((a, b) => b - a)) {
            pdf.removePage(page - 1);
        }

        setProgress(80);
        const bytes = await pdf.save();
        output.save(pdfBytesToBlob(bytes), file.name.replace(".pdf", "_removed.pdf"));

        setProgress(100);
        setTimeout(() => { setIsProcessing(false); setProgress(0); }, 1000);
    };

    const parsed = parsePages();

    return (
        <ToolWorkspace category="PDF tools" backHref="/pdf" title="Remove Pages" description="Select pages to remove from a new copy of your PDF.">
            <div className="mx-auto max-w-3xl space-y-4">
                {file && <ToolPanel stage="input" title="Source PDF" action={<Button variant="ghost" size="sm" disabled={isProcessing} onClick={() => setFile(null)}>Change</Button>}><ToolFile blob={file} name={file.name} detail={pageCount + " pages"} /></ToolPanel>}
                {!file ? (
                    <ToolPanel stage="input" title="Source PDF">
                        <FilePicker accept=".pdf,application/pdf" action="Choose PDF" hint="Or drop a PDF here."
                            onFiles={files => { if (files.length === 1) void handleFile(files[0]); }} />
                    </ToolPanel>
                ) : (
                    <ToolPanel stage="settings" title="Settings">


                        <div className="border rounded-xl p-4 mb-4">
                            <PdfPagePicker file={file} total={pageCount} value={pagesToRemove} onChange={setPagesToRemove}
                                label="Pages to remove" ordered={false} disabled={isProcessing} />
                            {pagesToRemove.trim() && !parsed.length && <p className="mt-2 text-sm text-destructive">Choose pages numbered 1–{pageCount}.</p>}
                            {parsed.length > 0 && parsed.length === pageCount && <p className="mt-2 text-sm text-destructive">Keep at least one page.</p>}
                            {parsed.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    {parsed.length} {parsed.length === 1 ? "page" : "pages"} marked for removal
                                </p>
                            )}
                        </div>

                        {isProcessing && <Progress value={progress} className="h-1.5 mb-4" />}

                        <Button onClick={removePages} disabled={isProcessing || parsed.length === 0 || parsed.length === pageCount} className="w-full h-11">
                            <Trash2 className="h-4 w-4 mr-2" />Remove & Download
                        </Button>
                    </ToolPanel>
                )}

                <ToolOutput file={output.file} />
            </div>
        </ToolWorkspace>
    );
}
