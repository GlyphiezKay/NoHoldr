"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ToolFile } from "@/components/layout/tool-file";
import { EmptyOutput, ViewToolResult } from "@/components/layout/tool-output";
import { downloadFile, downloadAsZip } from "@/lib/download-manager";
import { openLocalImage, makeImageCanvas, encodeCanvas } from "@/lib/image-processing";
import { openPdf, renderPdfCanvas } from "@/lib/pdf-render";
import { fileStem } from "@/lib/file-utilities";
import { officeToPdf } from "@/lib/office-pdf";
import { exportWav } from "@/lib/audio-export";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { csvToJSON, jsonToCSV } from "@/lib/csv-utils";
import { recordVideo, extractVideoFrame as readVideoFrame } from "@/lib/video-utils";
import {
    FileText, Image, Music, Video, Database, Download, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { detectFileType, type DetectedFile, type FileCategory } from "@/lib/file-detector";

interface TargetFormat {
    id: string;
    format: string;
    description: string;
    mimeType: string;
    extension: string;
}

interface FormatGroup {
    name: string;
    icon: typeof Image;
    formats: TargetFormat[];
}

const IMAGE_FORMATS: TargetFormat[] = [
    { id: "jpg", format: "JPG", description: "Lossy, smaller size", mimeType: "image/jpeg", extension: "jpg" },
    { id: "png", format: "PNG", description: "Lossless, transparency", mimeType: "image/png", extension: "png" },
    { id: "webp", format: "WEBP", description: "Modern, efficient", mimeType: "image/webp", extension: "webp" },
];

const DOCUMENT_FORMATS: TargetFormat[] = [
    { id: "pdf", format: "PDF", description: "Universal document", mimeType: "application/pdf", extension: "pdf" },
];

const AUDIO_FORMATS: TargetFormat[] = [
    { id: "wav", format: "WAV", description: "Uncompressed audio", mimeType: "audio/wav", extension: "wav" },
];

const VIDEO_FORMATS: TargetFormat[] = [
    { id: "webm-vp9", format: "WEBM (VP9)", description: "Modern, efficient", mimeType: "video/webm", extension: "webm" },
    { id: "webm-vp8", format: "WEBM (VP8)", description: "Wide support", mimeType: "video/webm", extension: "webm" },
    { id: "frame-jpg", format: "Frame JPG", description: "Extract frame", mimeType: "image/jpeg", extension: "jpg" },
    { id: "frame-png", format: "Frame PNG", description: "Extract frame", mimeType: "image/png", extension: "png" },
];

const DATA_FORMATS: TargetFormat[] = [
    { id: "json", format: "JSON", description: "Structured data", mimeType: "application/json", extension: "json" },
    { id: "csv", format: "CSV", description: "Tabular data", mimeType: "text/csv", extension: "csv" },
];

const CATEGORY_FORMAT_GROUPS: Record<FileCategory, FormatGroup[]> = {
    image: [
        { name: "Image", icon: Image, formats: IMAGE_FORMATS },
        { name: "Document", icon: FileText, formats: DOCUMENT_FORMATS },
    ],
    pdf: [
        { name: "Image", icon: Image, formats: IMAGE_FORMATS },
    ],
    document: [
        { name: "Document", icon: FileText, formats: DOCUMENT_FORMATS },
    ],
    audio: [{ name: "Audio", icon: Music, formats: AUDIO_FORMATS }],
    video: [
        { name: "Video", icon: Video, formats: VIDEO_FORMATS },
    ],
    data: [{ name: "Data", icon: Database, formats: DATA_FORMATS }],
    archive: [],
    unsupported: [],
};

export default function SmartConvertPage() {
    const [detectedFile, setDetectedFile] = useState<DetectedFile | null>(null);
    const [selectedFormat, setSelectedFormat] = useState<TargetFormat | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [convertedBlobs, setConvertedBlobs] = useState<{ name: string; blob: Blob }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    const handleFile = useCallback((file: File) => {
        setDetectedFile(detectFileType(file));
        setSelectedFormat(null);
        setConvertedBlobs([]);
        setError(null);
        setWarning(null);
    }, []);

    const clearFile = () => {
        setDetectedFile(null);
        setSelectedFormat(null);
        setConvertedBlobs([]);
        setError(null);
        setWarning(null);
    };

    const convert = async () => {
        if (!detectedFile || !selectedFormat) return;
        setIsConverting(true);
        setProgress(10);
        setError(null);
        setWarning(null);
        setConvertedBlobs([]);

        try {
            const file = detectedFile.file;
            const results: { name: string; blob: Blob }[] = [];

            // Image conversions
            if (detectedFile.category === "image") {
                if (["jpg", "png", "webp", "avif", "bmp", "gif", "ico"].includes(selectedFormat.id)) {
                    const blob = await convertImage(file, selectedFormat.mimeType);
                    results.push({ name: fileStem(file.name) + `.${selectedFormat.extension}`, blob });
                } else if (selectedFormat.id === "pdf") {
                    const blob = await imageToPdf(file);
                    results.push({ name: fileStem(file.name) + ".pdf", blob });
                }
            }
            // PDF to Image
            else if (detectedFile.category === "pdf" && ["jpg", "png", "webp", "avif", "bmp", "gif"].includes(selectedFormat.id)) {
                const pages = await pdfToImages(file, selectedFormat.mimeType, selectedFormat.extension);
                results.push(...pages);
                if (pages.length > 1) {
                    setWarning(`Converted ${pages.length} pages. Download each page individually.`);
                }
            }
            // Document to PDF
            else if (detectedFile.category === "document" && selectedFormat.id === "pdf") {
                const blob = await officeToPdf(file, "word", setWarning);
                results.push({ name: fileStem(file.name) + ".pdf", blob });
                setWarning(null);
            }
            // Audio conversion
            else if (detectedFile.category === "audio" && selectedFormat.id === "wav") {
                const blob = await exportWav(file, { start: 0, depth: 16, mono: false, normalize: false });
                results.push({ name: fileStem(file.name) + `.${selectedFormat.extension}`, blob });
            }
            // Video to WebM
            else if (detectedFile.category === "video" && ["webm-vp9", "webm-vp8"].includes(selectedFormat.id)) {
                setWarning("Video transcoding is resource-intensive. This may take a while.");
                const blob = await convertVideoToWebm(file, selectedFormat.id);
                results.push({ name: fileStem(file.name) + ".webm", blob });
            }
            // Video to Image (frame extraction)
            else if (detectedFile.category === "video" && ["frame-jpg", "frame-png"].includes(selectedFormat.id)) {
                const blob = await extractVideoFrame(file, selectedFormat.mimeType);
                results.push({ name: fileStem(file.name) + `-frame.${selectedFormat.extension}`, blob });
            }
            // Data conversions
            else if (detectedFile.category === "data") {
                const blob = await convertData(file, selectedFormat.id);
                results.push({ name: fileStem(file.name) + `.${selectedFormat.extension}`, blob });
            }
            else {
                throw new Error("Conversion not supported");
            }

            if (!results.length) throw new Error("No output was generated for this conversion.");
            setProgress(100);
            setConvertedBlobs(results);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Conversion failed");
        }
        setIsConverting(false);
    };

    // === Conversion Functions ===

    async function convertImage(file: File, mimeType: string) {
        const image = await openLocalImage(file);
        const { canvas, context } = makeImageCanvas(image.naturalWidth, image.naturalHeight);
        try {
            if (mimeType === "image/jpeg") {
                context.fillStyle = "#fff";
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            context.drawImage(image, 0, 0);
            return await encodeCanvas(canvas, mimeType, 0.92);
        } finally {
            canvas.width = canvas.height = 0;
        }
    }

    async function imageToPdf(file: File) {
        const { PDFDocument } = await import("pdf-lib");
        const image = await convertImage(file, "image/png");
        const document = await PDFDocument.create();
        const asset = await document.embedPng(await image.arrayBuffer());
        document.addPage([asset.width, asset.height]).drawImage(asset, { x: 0, y: 0 });
        return new Blob([new Uint8Array(await document.save()).buffer], { type: "application/pdf" });
    }

    async function pdfToImages(file: File, mimeType: string, ext: string) {
        const task = await openPdf(file);
        try {
            const pdf = await task.promise;
            const files: { name: string; blob: Blob }[] = [];
            for (let number = 1; number <= pdf.numPages; number++) {
                const page = await pdf.getPage(number);
                const { canvas } = await renderPdfCanvas(page, 4096);
                try {
                    files.push({ name: `${fileStem(file.name)}-page${number}.${ext}`, blob: await encodeCanvas(canvas, mimeType, 0.92) });
                    setProgress(10 + (80 * number / pdf.numPages));
                } finally {
                    canvas.width = canvas.height = 0;
                    page.cleanup();
                }
            }
            return files;
        } finally {
            await task.destroy().catch(() => {});
        }
    }

    const convertVideoToWebm = (file: File, codec: string): Promise<Blob> => recordVideo(file, { mimeType: codec === "webm-vp8" ? "video/webm;codecs=vp8,opus" : "video/webm;codecs=vp9,opus", onProgress: p => setProgress(10 + p * 0.8) });

    const extractVideoFrame = (file: File, targetMime: string): Promise<Blob> => readVideoFrame(file, 0, targetMime);

    const convertData = async (file: File, targetId: string): Promise<Blob> => {
        const text = await file.text();
        setProgress(30);
        const ext = file.name.split(".").pop()?.toLowerCase();
        let result: string;
        if (ext === "json" && targetId === "csv") {
            result = jsonToCSV(JSON.parse(text));
        } else if (ext === "csv" && targetId === "json") {
            result = JSON.stringify(csvToJSON(text), null, 2);
        } else throw new Error("Unsupported data conversion");
        setProgress(80);
        return new Blob([result], { type: targetId === "json" ? "application/json" : "text/csv" });
    };

    async function downloadAllAsZip() {
        if (!detectedFile) return;
        try {
            await downloadAsZip(convertedBlobs, fileStem(detectedFile.file.name) + "_converted.zip");
        } catch {
            setError("Could not package the results. Download the files individually.");
        }
    }

    const formatGroups = detectedFile ? (CATEGORY_FORMAT_GROUPS[detectedFile.category] || []).map(group => ({
        ...group,
        formats: group.formats.filter(format => {
            if (detectedFile.category === "document") return detectedFile.extension === "docx";
            if (detectedFile.category === "data") return (detectedFile.extension === "csv" && format.id === "json") || (detectedFile.extension === "json" && format.id === "csv");
            return true;
        }),
    })).filter(group => group.formats.length > 0) : [];


    return (
      <ToolWorkspace tone="convert" category="All tools" backHref="/" title="Smart Convert" description="Pick a file to see formats that can be generated for it.">
        <nav aria-label="Dedicated converters" className="mb-5 flex flex-wrap gap-2">
          {["image", "audio", "video", "document"].map(type => <Button key={type} asChild variant="outline" className="capitalize"><Link href={"/convert/" + type}>{type} converter</Link></Button>)}
        </nav>
        <div className="studio-flow">
          <ToolPanel stage="input" title="Source file" description="Choose one file at a time."
            action={detectedFile && <Button variant="ghost" size="sm" disabled={isConverting} onClick={clearFile}>Remove file</Button>}>
            {detectedFile && <div className="mb-4"><ToolFile blob={detectedFile.file} name={detectedFile.file.name} detail={detectedFile.displayType} /></div>}
            <FilePicker action={detectedFile ? "Replace file" : "Choose file"} hint="Or drop a file here." disabled={isConverting}
              onFiles={files => {
                if (files.length > 1) { setError("Choose one file at a time."); return; }
                handleFile(files[0]);
              }} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Try an image, PDF, DOCX, audio, video, CSV, or JSON file.</p>
          </ToolPanel>

            <ToolPanel stage="settings" title="Output format" description={detectedFile ? "Select a format and run the conversion." : "Add a source file to see its available formats."}>
              {detectedFile && formatGroups.length === 0 && <p role="status" className="rounded-xl bg-accent p-3 text-sm">No conversion is available for this file type. Try a different source file.</p>}
              {formatGroups.length > 0 && (
                <div className="space-y-4">
                  {formatGroups.map(group => (
                    <fieldset key={group.name}>
                      <legend className="mb-2 text-sm font-semibold">{group.name}</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.formats.map(format => (
                          <label key={format.id} className="relative block cursor-pointer rounded-xl border p-3 has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-2 has-disabled:cursor-not-allowed">
                            <input className="sr-only" type="radio" name="format" value={format.id} checked={selectedFormat?.id === format.id}
                              disabled={isConverting} onChange={() => { setSelectedFormat(format); setError(null); }} />
                            <span className="block text-sm font-semibold">{format.format}</span>
                            <span className="block text-sm text-muted-foreground">{format.description}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <Button size="lg" className="w-full" onClick={convert} disabled={!selectedFormat || isConverting}>
                    {isConverting ? <><Loader2 className="animate-spin" />Converting…</> : selectedFormat ? `Convert to ${selectedFormat.format}` : "Convert file"}
                  </Button>
                </div>
              )}
              {isConverting && <Progress aria-label="Conversion progress" value={progress} className="mt-4" />}
              {warning && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{warning}</p>}
              {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
              {convertedBlobs.length > 0 && <ViewToolResult />}
            </ToolPanel>
            <ToolPanel stage="result" title="Results" action={convertedBlobs.length > 1 &&
              <Button variant="outline" onClick={downloadAllAsZip}><Download />Download ZIP</Button>}>
              {convertedBlobs.length ? <ul className="grid gap-2 sm:grid-cols-2">
                {convertedBlobs.map(item => <li key={item.name} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1"><ToolFile blob={item.blob} name={item.name} /></div>
                  <Button variant="outline" size="icon" aria-label={"Download " + item.name} onClick={() => downloadFile(item.blob, item.name)}><Download /></Button>
                </li>)}
              </ul> : <EmptyOutput />}
            </ToolPanel>
        </div>
      </ToolWorkspace>
    );
}