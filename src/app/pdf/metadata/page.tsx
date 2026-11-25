"use client";

import { useState, useCallback } from "react";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolWorkspace, ToolPanel } from "@/components/layout/tool-workspace";
import { ToolFile } from "@/components/layout/tool-file";
import { Button } from "@/components/ui/button";
import { PDFDocument } from "pdf-lib";

interface PDFMetadata {
    title: string | undefined;
    author: string | undefined;
    subject: string | undefined;
    creator: string | undefined;
    producer: string | undefined;
    creationDate: Date | undefined;
    modificationDate: Date | undefined;
    pageCount: number;
    keywords: string | undefined;
}

export default function PDFMetadataPage() {
    const [file, setFile] = useState<File | null>(null);
    const [metadata, setMetadata] = useState<PDFMetadata | null>(null);

    const handleFile = useCallback(async (f: File) => {
        if (f.type !== "application/pdf") return;
        const pdf = await PDFDocument.load(await f.arrayBuffer());
        setFile(f);
        setMetadata({
            title: pdf.getTitle(),
            author: pdf.getAuthor(),
            subject: pdf.getSubject(),
            creator: pdf.getCreator(),
            producer: pdf.getProducer(),
            creationDate: pdf.getCreationDate(),
            modificationDate: pdf.getModificationDate(),
            pageCount: pdf.getPageCount(),
            keywords: pdf.getKeywords(),
        });
    }, []);

    const formatDate = (date: Date | undefined) => date ? date.toLocaleString() : "—";

    return (
        <ToolWorkspace category="PDF tools" backHref="/pdf" title="View PDF Metadata" description="Inspect the properties stored in a PDF.">
            <div className="mx-auto max-w-3xl space-y-4">
                {file && <ToolPanel stage="input" title="Source PDF" action={<Button variant="ghost" size="sm" onClick={() => { setFile(null); setMetadata(null); }}>Change</Button>}><ToolFile blob={file} name={file.name} /></ToolPanel>}
                {!file ? (
                    <ToolPanel stage="input" title="Source PDF">
                        <FilePicker accept=".pdf,application/pdf" action="Choose PDF" hint="Or drop a PDF here."
                            onFiles={files => { if (files.length === 1) void handleFile(files[0]); }} />
                    </ToolPanel>
                ) : metadata && (
                    <ToolPanel stage="result" title="Metadata tags">
                        <div className="border rounded-xl p-4 mb-4">


                            <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                                    <span className="text-muted-foreground">Title</span>
                                    <span className="col-span-2 font-medium">{metadata.title || "—"}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                                    <span className="text-muted-foreground">Author</span>
                                    <span className="col-span-2 font-medium">{metadata.author || "—"}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                                    <span className="text-muted-foreground">Subject</span>
                                    <span className="col-span-2 font-medium">{metadata.subject || "—"}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                                    <span className="text-muted-foreground">Creator</span>
                                    <span className="col-span-2 font-medium">{metadata.creator || "—"}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                                    <span className="text-muted-foreground">Producer</span>
                                    <span className="col-span-2 font-medium">{metadata.producer || "—"}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                                    <span className="text-muted-foreground">Pages</span>
                                    <span className="col-span-2 font-medium">{metadata.pageCount}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                                    <span className="text-muted-foreground">Created</span>
                                    <span className="col-span-2 font-medium">{formatDate(metadata.creationDate)}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                                    <span className="text-muted-foreground">Modified</span>
                                    <span className="col-span-2 font-medium">{formatDate(metadata.modificationDate)}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                                    <span className="text-muted-foreground">Keywords</span>
                                    <span className="col-span-2 font-medium">{metadata.keywords || "—"}</span>
                                </div>
                            </div>
                        </div>
                    </ToolPanel>
                )}

            </div>
        </ToolWorkspace>
    );
}
