"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { recordVideo, extractVideoFrame } from "@/lib/video-utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Video as VideoIcon, Download } from "lucide-react";

const OUTPUT_FORMATS = [
    { value: "webm-vp9", label: "WebM (VP9)", desc: "Modern, efficient", mime: "video/webm;codecs=vp9", ext: "webm" },
    { value: "webm-vp8", label: "WebM (VP8)", desc: "Wide support", mime: "video/webm;codecs=vp8", ext: "webm" },
    { value: "frame-jpg", label: "Frame → JPEG", desc: "Extract single frame", mime: "image/jpeg", ext: "jpg" },
    { value: "frame-png", label: "Frame → PNG", desc: "Extract frame (lossless)", mime: "image/png", ext: "png" },
];

const BITRATES = [
    { value: 1000000, label: "1 Mbps (small)" },
    { value: 2500000, label: "2.5 Mbps" },
    { value: 5000000, label: "5 Mbps (default)" },
    { value: 8000000, label: "8 Mbps" },
    { value: 12000000, label: "12 Mbps (HQ)" },
];

function formatBytes(b: number) { return b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB"; }
function formatDuration(s: number) { const m = Math.floor(s / 60); return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`; }

export default function VideoConverterPage() {
    const [file, setFile] = useState<File | null>(null);
    const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
    const [convertedSize, setConvertedSize] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [targetFormat, setTargetFormat] = useState("webm-vp9");
    const [bitrate, setBitrate] = useState(5000000);
    const [duration, setDuration] = useState(0);
    const [resolution, setResolution] = useState<"original" | "720" | "480" | "360">("original");
    const [frameTime, setFrameTime] = useState(0);
    const [fps, setFps] = useState(30);
    const [error, setError] = useState("");

    const handleFile = useCallback((f: File) => {
        if (!f.type.startsWith("video/") && !/\.(mp4|mov|avi|mkv|webm|wmv|flv)$/i.test(f.name)) return;
        setFile(f); setConvertedUrl(null); setError("");
        const vid = document.createElement("video");
        vid.onloadedmetadata = () => { setDuration(vid.duration); setFrameTime(0); };
        vid.src = URL.createObjectURL(f);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    }, [handleFile]);

    const extractFrame = (): Promise<Blob> => extractVideoFrame(file!, frameTime, targetFormat === "frame-png" ? "image/png" : "image/jpeg");

    const convertToWebm = (): Promise<Blob> => recordVideo(file!, { mimeType: targetFormat === "webm-vp8" ? "video/webm;codecs=vp8,opus" : "video/webm;codecs=vp9,opus", fps, bitrate, maxHeight: resolution === "original" ? undefined : Number(resolution), onProgress: p => setProgress(10 + p * 0.9) });

    const convertVideo = async () => {
        if (!file) return;
        setIsProcessing(true); setProgress(10); setError("");

        try {
            let blob: Blob;
            if (targetFormat.startsWith("frame-")) {
                blob = await extractFrame();

            } else {
                blob = await convertToWebm();
            }
            setConvertedUrl(URL.createObjectURL(blob));
            setConvertedSize(blob.size);
            setProgress(100);
        } catch (e) {
            setError((e as Error).message || "Conversion failed");
        }
        setIsProcessing(false);
    };

    const download = () => {
        if (!convertedUrl || !file) return;
        const fmt = OUTPUT_FORMATS.find(f => f.value === targetFormat)!;
        const a = document.createElement("a"); a.href = convertedUrl;
        a.download = file.name.replace(/\.[^.]+$/, "." + fmt.ext); a.click();
    };

    const isFrame = targetFormat.startsWith("frame-");
    const isWebm = targetFormat.startsWith("webm-");

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <Link href="/convert"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-xl font-semibold">Video Converter</h1>
                    <p className="text-sm text-muted-foreground">WebM (VP8/VP9) • Frame Extract (JPG/PNG)</p>
                </div>
            </div>

            {/* Upload */}
            <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-4 ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleDrop}
                onClick={() => document.getElementById("video-up")?.click()}
            >
                <input type="file" accept="video/*,.mp4,.mov,.avi,.mkv,.webm" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" id="video-up" />
                <VideoIcon className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm"><span className="font-medium">Drop video</span> or click</p>
                <p className="text-xs text-muted-foreground mt-1">MP4, MOV, AVI, MKV, WebM</p>
            </div>

            {file && (
                <>
                    {/* File info */}
                    <div className="border rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <VideoIcon className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatBytes(file.size)} • {duration > 0 ? formatDuration(duration) : "..."}</p>
                            </div>
                            {convertedSize > 0 && <span className="text-xs text-muted-foreground">→ {formatBytes(convertedSize)}</span>}
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="border rounded-xl p-4 mb-4 space-y-3">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Output</label>
                            <Select value={targetFormat} onValueChange={value => { if (convertedUrl) URL.revokeObjectURL(convertedUrl); setConvertedUrl(null); setTargetFormat(value); }} disabled={isProcessing}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {OUTPUT_FORMATS.map(f => (
                                        <SelectItem key={f.value} value={f.value}>
                                            <span className="font-medium">{f.label}</span>
                                            <span className="text-xs text-muted-foreground ml-2">{f.desc}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {isWebm && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Bitrate</label>
                                        <select value={bitrate} onChange={e => setBitrate(+e.target.value)}
                                            className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                                            {BITRATES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Resolution</label>
                                        <select value={resolution} onChange={e => setResolution(e.target.value as typeof resolution)}
                                            className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                                            <option value="original">Original</option>
                                            <option value="720">720p</option>
                                            <option value="480">480p</option>
                                            <option value="360">360p</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Frame rate</label>
                                    <div className="flex gap-1">
                                        {[15, 24, 30, 60].map(f => (
                                            <button key={f} onClick={() => setFps(f)}
                                                className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${fps === f ? "bg-foreground text-background" : ""}`}>
                                                {f} fps
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {isFrame && duration > 0 && (
                            <div>
                                <label className="text-xs text-muted-foreground">Frame at: {frameTime.toFixed(1)}s / {formatDuration(duration)}</label>
                                <input type="range" min={0} max={duration} step={0.1} value={frameTime}
                                    onChange={e => setFrameTime(+e.target.value)} className="w-full accent-primary" />
                            </div>
                        )}
                    </div>

                    {isProcessing && <Progress value={progress} className="h-2 mb-4" />}
                    {error && <p className="text-sm text-destructive text-center mb-4">{error}</p>}

                    <div className="flex gap-2">
                        <Button onClick={convertVideo} disabled={isProcessing} className="flex-1">
                            {isProcessing ? "Converting..." : `Convert to ${OUTPUT_FORMATS.find(f => f.value === targetFormat)?.label}`}
                        </Button>
                        {convertedUrl && (
                            <Button variant="outline" onClick={download}>
                                <Download className="h-4 w-4 mr-2" />Download
                            </Button>
                        )}
                    </div>


                </>
            )}

            <p className="text-xs text-muted-foreground text-center mt-6">Processed locally in your browser</p>
        </div>
    );
}
