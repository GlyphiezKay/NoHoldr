"use client";

import { useState, useCallback } from "react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { csvToJSON, jsonToCSV } from "@/lib/csv-utils";
import { recordVideo, extractVideoFrame as readVideoFrame } from "@/lib/video-utils";
import {
    Upload, FileText, Image, Music, Video, FileArchive, Database,
    AlertCircle, Download, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { detectFileType, formatFileSize, type DetectedFile, type FileCategory } from "@/lib/file-detector";

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

const CATEGORY_ICONS: Record<FileCategory, typeof Image> = {
    image: Image, pdf: FileText, document: FileText, audio: Music,
    video: Video, archive: FileArchive, data: Database, unsupported: AlertCircle,
};

const CATEGORY_COLORS: Record<FileCategory, string> = {
    image: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
    pdf: "text-red-500 bg-red-50 dark:bg-red-950/30",
    document: "text-purple-500 bg-purple-50 dark:bg-purple-950/30",
    audio: "text-green-500 bg-green-50 dark:bg-green-950/30",
    video: "text-orange-500 bg-orange-50 dark:bg-orange-950/30",
    archive: "text-amber-500 bg-amber-50 dark:bg-amber-950/30",
    data: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30",
    unsupported: "text-gray-500 bg-gray-50 dark:bg-gray-950/30",
};

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
                    results.push({ name: file.name.replace(/\.[^.]+$/, `.${selectedFormat.extension}`), blob });
                } else if (selectedFormat.id === "pdf") {
                    const blob = await imageToPdf(file);
                    results.push({ name: file.name.replace(/\.[^.]+$/, ".pdf"), blob });
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
                const blob = await documentToPdf(file);
                results.push({ name: file.name.replace(/\.[^.]+$/, ".pdf"), blob });
                setWarning("Layout may differ from original. Complex formatting, fonts, and images may not render perfectly.");
            }
            // Audio conversion
            else if (detectedFile.category === "audio" && ["wav", "ogg", "webm-audio"].includes(selectedFormat.id)) {
                const blob = await convertAudioToWav(file);
                results.push({ name: file.name.replace(/\.[^.]+$/, `.${selectedFormat.extension}`), blob });
            }
            // Video to WebM
            else if (detectedFile.category === "video" && ["webm-vp9", "webm-vp8"].includes(selectedFormat.id)) {
                setWarning("Video transcoding is resource-intensive. This may take a while.");
                const blob = await convertVideoToWebm(file, selectedFormat.id);
                results.push({ name: file.name.replace(/\.[^.]+$/, ".webm"), blob });
            }
            // Video to Image (frame extraction)
            else if (detectedFile.category === "video" && ["frame-jpg", "frame-png"].includes(selectedFormat.id)) {
                const blob = await extractVideoFrame(file, selectedFormat.mimeType);
                results.push({ name: file.name.replace(/\.[^.]+$/, `-frame.${selectedFormat.extension}`), blob });
            }
            // Data conversions
            else if (detectedFile.category === "data") {
                const blob = await convertData(file, selectedFormat.id);
                results.push({ name: file.name.replace(/\.[^.]+$/, `.${selectedFormat.extension}`), blob });
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

    const convertImage = async (file: File, targetMime: string): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                setProgress(50);
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) { reject(new Error("Canvas error")); return; }
                ctx.drawImage(img, 0, 0);
                setProgress(80);
                canvas.toBlob((blob) => blob && blob.type === targetMime ? resolve(blob) : reject(new Error("Output format is unsupported by this browser")), targetMime, 0.92);
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = URL.createObjectURL(file);
        });
    };

    const imageToPdf = async (file: File): Promise<Blob> => {
        const { PDFDocument } = await import("pdf-lib");
        const img = new window.Image();
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = URL.createObjectURL(file); });
        setProgress(40);
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([img.width, img.height]);
        setProgress(60);
        const imageBytes = await file.arrayBuffer();
        const pdfImage = file.type === "image/png" ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
        page.drawImage(pdfImage, { x: 0, y: 0, width: img.width, height: img.height });
        setProgress(80);
        const pdfBytes = await pdfDoc.save();
        return new Blob([new Uint8Array(pdfBytes).buffer], { type: "application/pdf" });
    };

    const pdfToImages = async (file: File, mimeType: string, ext: string): Promise<{ name: string; blob: Blob }[]> => {
        const { pdfjsLib } = await import("@/lib/pdfjs-setup");

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const results: { name: string; blob: Blob }[] = [];
        const baseName = file.name.replace(/\.pdf$/i, "");

        for (let i = 1; i <= pdf.numPages; i++) {
            setProgress(10 + (80 * i / pdf.numPages));
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 }); // 2x for quality
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d")!;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

            const blob = await new Promise<Blob>((res, rej) => {
                canvas.toBlob((b) => b && b.type === mimeType ? res(b) : rej(new Error("Output format is unsupported by this browser")), mimeType, 0.92);
            });
            results.push({ name: `${baseName}-page${i}.${ext}`, blob });
        }
        return results;
    };

    const documentToPdf = async (file: File): Promise<Blob> => {
        const mammoth = await import("mammoth");
        const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

        setProgress(20);
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value;

        setProgress(40);
        // Parse HTML to extract text
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const textContent = doc.body.innerText || doc.body.textContent || "";
        const paragraphs = textContent.split("\n").filter(p => p.trim());

        setProgress(60);
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 12;
        const margin = 50;
        const lineHeight = fontSize * 1.5;

        let page = pdfDoc.addPage([612, 792]); // Letter size
        let y = 792 - margin;

        for (const para of paragraphs) {
            const words = para.split(" ");
            let line = "";

            for (const word of words) {
                const testLine = line ? `${line} ${word}` : word;
                const width = font.widthOfTextAtSize(testLine, fontSize);

                if (width > 612 - 2 * margin) {
                    if (y < margin + lineHeight) {
                        page = pdfDoc.addPage([612, 792]);
                        y = 792 - margin;
                    }
                    page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
                    y -= lineHeight;
                    line = word;
                } else {
                    line = testLine;
                }
            }

            if (line) {
                if (y < margin + lineHeight) {
                    page = pdfDoc.addPage([612, 792]);
                    y = 792 - margin;
                }
                page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
                y -= lineHeight * 1.5; // Paragraph spacing
            }
        }

        setProgress(90);
        const pdfBytes = await pdfDoc.save();
        return new Blob([new Uint8Array(pdfBytes).buffer], { type: "application/pdf" });
    };

    const convertAudioToWav = async (file: File): Promise<Blob> => {
        const audioContext = new AudioContext();
        const arrayBuffer = await file.arrayBuffer();
        setProgress(30);
        try {
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            setProgress(60);
            const wavBuffer = audioBufferToWav(audioBuffer);
            setProgress(90);
            return new Blob([wavBuffer], { type: "audio/wav" });
        } finally {
            await audioContext.close();
        }
    };

    const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const samples = buffer.length;
        const dataSize = samples * blockAlign;
        const bufferSize = 44 + dataSize;
        const arrayBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(arrayBuffer);
        const writeString = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
        writeString(0, "RIFF"); view.setUint32(4, bufferSize - 8, true); writeString(8, "WAVE"); writeString(12, "fmt ");
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true); view.setUint16(34, bitDepth, true); writeString(36, "data"); view.setUint32(40, dataSize, true);
        const channels: Float32Array[] = []; for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));
        let offset = 44;
        for (let i = 0; i < samples; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }
        return arrayBuffer;
    };

    const convertVideoToWebm = (file: File, codec: string): Promise<Blob> => recordVideo(file, { mimeType: codec === "webm-vp8" ? "video/webm;codecs=vp8,opus" : "video/webm;codecs=vp9,opus", onProgress: p => setProgress(10 + p * 0.8) });

    const extractVideoFrame = (file: File, targetMime: string): Promise<Blob> => readVideoFrame(file, 1, targetMime);

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

    const downloadBlob = (name: string, blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    const downloadAllAsZip = async () => {
        const { downloadAsZip } = await import("@/lib/download-manager");
        const baseName = detectedFile?.file.name.replace(/\.[^.]+$/, "") || "converted";
        await downloadAsZip(convertedBlobs, `${baseName}_converted.zip`);
    };

    const formatGroups = detectedFile ? (CATEGORY_FORMAT_GROUPS[detectedFile.category] || []).map(group => ({
        ...group,
        formats: group.formats.filter(format => {
            if (detectedFile.category === "document") return detectedFile.extension === "docx";
            if (detectedFile.category === "data") return (detectedFile.extension === "csv" && format.id === "json") || (detectedFile.extension === "json" && format.id === "csv");
            return true;
        }),
    })).filter(group => group.formats.length > 0) : [];
    const CategoryIcon = detectedFile ? CATEGORY_ICONS[detectedFile.category] : Upload;

    return (
      <ToolWorkspace category="All tools" backHref="/" title="Smart Convert" description="Pick a file to see formats that can be generated for it.">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <ToolPanel title="Source file" description="Choose one file at a time."
            action={detectedFile && <Button variant="ghost" size="sm" disabled={isConverting} onClick={clearFile}>Remove file</Button>}>
            {detectedFile && (
              <div className={`mb-4 flex items-center gap-3 rounded-xl border p-3 ${CATEGORY_COLORS[detectedFile.category]}`}>
                <CategoryIcon className="size-6 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="break-all text-sm font-semibold">{detectedFile.file.name}</p>
                  <p className="text-sm">{detectedFile.displayType} · {formatFileSize(detectedFile.file.size)}</p>
                </div>
              </div>
            )}
            <FilePicker action={detectedFile ? "Replace file" : "Choose file"} hint="Or drop a file here." disabled={isConverting}
              onFiles={files => {
                if (files.length > 1) { setError("Choose one file at a time."); return; }
                handleFile(files[0]);
              }} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Try an image, PDF, DOCX, audio, video, CSV, or JSON file.</p>
          </ToolPanel>

          <div className="min-w-0 space-y-5">
            <ToolPanel title="Output format" description={detectedFile ? "Select a format and run the conversion." : "Add a source file to see its available formats."}>
              {detectedFile && formatGroups.length === 0 && <p role="status" className="rounded-xl bg-accent p-3 text-sm">No conversion is available for this file type. Try a different source file.</p>}
              {formatGroups.length > 0 && (
                <div className="space-y-4">
                  {formatGroups.map(group => (
                    <fieldset key={group.name}>
                      <legend className="mb-2 text-sm font-semibold">{group.name}</legend>
                      <div className="grid grid-cols-2 gap-2">
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
            </ToolPanel>

            {convertedBlobs.length > 0 && (
              <ToolPanel title="Results" description="Download your files, or select another format to convert the same source again.">
                <div className="space-y-2">
                  {convertedBlobs.length > 1 && (
                    <Button onClick={downloadAllAsZip} className="w-full"><Download /> Download as ZIP ({convertedBlobs.length} files)</Button>
                  )}
                  {convertedBlobs.map((item, index) => (
                    <Button key={index} onClick={() => downloadBlob(item.name, item.blob)} variant="outline" className="w-full min-w-0 justify-start">
                      <Download /><span className="truncate" title={item.name}>{item.name}</span>
                    </Button>
                  ))}
                </div>
              </ToolPanel>
            )}
          </div>
        </div>
      </ToolWorkspace>
    );
}