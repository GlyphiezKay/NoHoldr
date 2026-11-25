"use client";

import { PdfPagePicker } from "@/components/pdf/pdf-page-picker";
import { useState } from "react";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolWorkspace, ToolPanel } from "@/components/layout/tool-workspace";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { ToolFile } from "@/components/layout/tool-file";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Download, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { parsePdfPages } from "@/lib/pdf-pages";
import { pdfBytesToBlob } from "@/lib/pdf-utils";
import JSZip from "jszip";

interface Section {
    id: string;
    name: string;
    pageRanges: string;
    isValid: boolean;
    parsedPages: number[];
}

const presetSections = [
    { label: "Judul / Cover", defaultName: "01_JUDUL" },
    { label: "Daftar Isi", defaultName: "02_DAFTAR_ISI" },
    { label: "Abstrak", defaultName: "03_ABSTRAK" },
    { label: "BAB I", defaultName: "04_BAB_I" },
    { label: "BAB II", defaultName: "05_BAB_II" },
    { label: "BAB III", defaultName: "06_BAB_III" },
    { label: "BAB IV", defaultName: "07_BAB_IV" },
    { label: "BAB V", defaultName: "08_BAB_V" },
    { label: "Daftar Pustaka", defaultName: "09_DAFTAR_PUSTAKA" },
    { label: "Lampiran", defaultName: "10_LAMPIRAN" },
    { label: "Custom", defaultName: "SECTION" },
];

export default function AcademicSplitPage() {
    const [file, setFile] = useState<File | null>(null);
    const output = useToolExport(file);
    const [pageCount, setPageCount] = useState(0);
    const [sections, setSections] = useState<Section[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("");


    const loadPdf = async (pdfFile: File) => {
        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            setFile(pdfFile);
            setPageCount(pdf.getPageCount());
            setSections([]);
        } catch (error) {
            console.error("Failed to load PDF:", error);
        }
    };

    const parsePageRanges = (input: string) => {
        try {
            const pages = parsePdfPages(input.replace(/\bAND\b/gi, ","), pageCount).sort((a, b) => a - b);
            return { valid: pages.length > 0, pages };
        } catch {
            return { valid: false, pages: [] };
        }
    };

    const addSection = (defaultName: string) => {
        setSections(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            name: defaultName,
            pageRanges: "",
            isValid: false,
            parsedPages: [],
        }]);
    };

    const updateSection = (id: string, field: "name" | "pageRanges", value: string) => {
        setSections(prev => prev.map(section => {
            if (section.id !== id) return section;
            const updated = { ...section, [field]: value };
            if (field === "pageRanges") {
                const result = parsePageRanges(value);
                updated.isValid = result.valid;
                updated.parsedPages = result.pages;
            }
            return updated;
        }));
    };

    const removeSection = (id: string) => setSections(prev => prev.filter(s => s.id !== id));

    const getOverlaps = (): number[] => {
        const counts: Map<number, number> = new Map();
        sections.forEach(s => s.parsedPages.forEach(p => counts.set(p, (counts.get(p) || 0) + 1)));
        return Array.from(counts.entries()).filter(([, c]) => c > 1).map(([p]) => p);
    };

    const handleSplit = async () => {
        if (!file || sections.length === 0) return;
        const overlaps = getOverlaps();
        if (overlaps.length > 0) { alert(`Overlapping pages: ${overlaps.join(", ")}`); return; }
        const validSections = sections.filter(s => s.isValid);
        if (validSections.length === 0) { alert("No valid sections"); return; }

        setIsProcessing(true);
        setProgress(0);
        setStatus("Loading PDF...");

        try {
            const arrayBuffer = await file.arrayBuffer();
            const sourcePdf = await PDFDocument.load(arrayBuffer);
            const zip = new JSZip();

            for (let i = 0; i < validSections.length; i++) {
                const section = validSections[i];
                setStatus(`Creating ${section.name}...`);
                setProgress(Math.round((i / validSections.length) * 80));

                const newPdf = await PDFDocument.create();
                const pageIndices = section.parsedPages.map(p => p - 1);
                const pages = await newPdf.copyPages(sourcePdf, pageIndices);
                pages.forEach(page => newPdf.addPage(page));

                const pdfBytes = await newPdf.save();
                const blob = pdfBytesToBlob(pdfBytes);
                zip.file(`${section.name}.pdf`, blob);
            }

            setStatus("Creating ZIP...");
            setProgress(90);

            const zipBlob = await zip.generateAsync({ type: "blob" });
            output.save(zipBlob, `${file.name.replace(/\.pdf$/i, "")}_sections.zip`);

            setProgress(100);
            setStatus("Done!");
            setTimeout(() => { setIsProcessing(false); setProgress(0); setStatus(""); }, 1500);
        } catch (error) {
            console.error("Split failed:", error);
            setStatus("Error: Failed to split PDF");
            setIsProcessing(false);
        }
    };

    const overlaps = getOverlaps();
    const allValid = sections.length > 0 && sections.every(s => s.isValid);

    return (
        <ToolWorkspace category="PDF tools" backHref="/pdf" title="Academic Split" description="Split a thesis into named sections and export a ZIP.">
            <div className="mx-auto max-w-3xl space-y-4">
                {file && <ToolPanel stage="input" title="Source PDF" action={<Button variant="ghost" size="sm" disabled={isProcessing} onClick={() => { setFile(null); setSections([]); }}>Change</Button>}><ToolFile blob={file} name={file.name} detail={pageCount + " pages"} /></ToolPanel>}
                {!file ? (
                    <ToolPanel stage="input" title="Source PDF">
                        <FilePicker accept=".pdf,application/pdf" action="Choose PDF" hint="Or drop a PDF here."
                            onFiles={files => { if (files.length === 1) void loadPdf(files[0]); }} />
                    </ToolPanel>
                ) : (
                    <ToolPanel stage="settings" title="Settings">


                        <Card className="mb-4">
                            <CardContent className="p-4">
                                <Label className="text-sm font-medium mb-2 block">Add Section</Label>
                                <div className="flex flex-wrap gap-2">
                                    {presetSections.map(p => (
                                        <Button key={p.label} variant="outline" size="sm" onClick={() => addSection(p.defaultName)}>
                                            <Plus className="h-3 w-3 mr-1" />{p.label}
                                        </Button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {sections.length > 0 && (
                            <Card className="mb-4">
                                <CardContent className="p-4 space-y-3">
                                    {sections.map((section) => (
                                        <div key={section.id} className="flex gap-2 items-start p-3 rounded border bg-muted/30">
                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                                <div>
                                                    <Label className="text-xs">Filename</Label>
                                                    <Input value={section.name} onChange={e => updateSection(section.id, "name", e.target.value)} className="mt-1 h-8 text-sm" />
                                                </div>
                                                <div>
                                                    <PdfPagePicker file={file} total={pageCount} value={section.pageRanges}
                                                        onChange={value => updateSection(section.id, "pageRanges", value)}
                                                        label={"Pages for " + (section.name || "section")} placeholder="1-3 AND 6-9"
                                                        allowAnd ordered={false} initialMode="type" disabled={isProcessing} />
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeSection(section.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                    <div className="pt-2 border-t">
                                        {overlaps.length > 0 && (
                                            <div className="flex items-center gap-2 text-destructive text-sm">
                                                <AlertTriangle className="h-4 w-4" /><span>Overlapping: {overlaps.join(", ")}</span>
                                            </div>
                                        )}
                                        {allValid && overlaps.length === 0 && (
                                            <div className="flex items-center gap-2 text-green-600 text-sm">
                                                <CheckCircle2 className="h-4 w-4" /><span>All sections valid</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isProcessing && (
                            <Card className="mb-4">
                                <CardContent className="py-3 px-4">
                                    <div className="flex justify-between text-sm mb-2"><span>{status}</span><span>{progress}%</span></div>
                                    <Progress value={progress} className="h-2" />
                                </CardContent>
                            </Card>
                        )}

                        <div className="flex justify-end">
                            <Button onClick={handleSplit} disabled={!allValid || overlaps.length > 0 || isProcessing}>
                                <Download className="h-4 w-4 mr-2" />Split & Download ZIP
                            </Button>
                        </div>
                    </ToolPanel>
                )}

                <ToolOutput file={output.file} />
            </div>
        </ToolWorkspace>
    );
}
