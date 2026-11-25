"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ToolFile } from "@/components/layout/tool-file";
import { EmptyOutput, useToolExport } from "@/components/layout/tool-output";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Image as ImageIcon, Download, Crop, RotateCcw, RotateCw, RefreshCcw, X, Move } from "lucide-react";
import { downloadAsZip, downloadFile } from "@/lib/download-manager";
import { encodeCanvas, makeImageCanvas, openLocalImage, uniqueImageName } from "@/lib/image-processing";

interface ImageFile {
    id: string;
    file: File;
}

interface CropBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

const ASPECT_RATIOS = [
    { label: "Free", value: 0 },
    { label: "1:1", value: 1 },
    { label: "4:3", value: 4 / 3 },
    { label: "3:4", value: 3 / 4 },
    { label: "16:9", value: 16 / 9 },
    { label: "9:16", value: 9 / 16 },
    { label: "3:2", value: 3 / 2 },
    { label: "2:3", value: 2 / 3 },
];

const OUTPUT_FORMATS = [
    { label: "JPEG", value: "image/jpeg", ext: "jpg" },
    { label: "PNG", value: "image/png", ext: "png" },
    { label: "WebP", value: "image/webp", ext: "webp" },
];

export default function CropImagePage() {
    const [mode, setMode] = useState<"manual" | "auto">("manual");
    const [file, setFile] = useState<File | null>(null);
    const manualOutput = useToolExport(file);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
    const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 100, h: 100 });
    const [aspectRatio, setAspectRatio] = useState<number>(0);
    const [rotation, setRotation] = useState(0);
    const [outputFormat, setOutputFormat] = useState("image/jpeg");
    const [quality, setQuality] = useState(92);
    const [error, setError] = useState("");

    // Drag state
    const [dragging, setDragging] = useState<"move" | "nw" | "ne" | "sw" | "se" | null>(null);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [startCrop, setStartCrop] = useState<CropBox>({ x: 0, y: 0, w: 0, h: 0 });

    // Auto mode
    const [batchImages, setBatchImages] = useState<ImageFile[]>([]);
    const [batchOutput, setBatchOutput] = useState<{ source: ImageFile[]; files: { blob: Blob; name: string }[] }>();
    const results = mode === "manual" ? (manualOutput.file ? [manualOutput.file] : []) :
        batchOutput?.source === batchImages ? batchOutput.files : [];
    const [autoAspectRatio, setAutoAspectRatio] = useState<number>(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const handleFile = useCallback((f: File) => {
        setError("");
        setNaturalSize({ w: 0, h: 0 });
        setFile(f);
        const url = URL.createObjectURL(f);
        setImageUrl(url);
        setRotation(0);
        setAspectRatio(0);
    }, []);

    useEffect(() => {
        if (!imageUrl) return;
        const img = new Image();
        img.onload = () => {
            setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            setCrop({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });
        };
        img.onerror = () => setError("Could not decode this image.");
        img.src = imageUrl;
        return () => {
            img.onload = img.onerror = null;
            URL.revokeObjectURL(imageUrl);
        };
    }, [imageUrl]);

    // Get displayed image rect
    const getImageRect = () => {
        if (!imgRef.current) return { left: 0, top: 0, width: 0, height: 0 };
        const rect = imgRef.current.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    };

    const addBatchImages = (files: File[]) => {
        const added = files.map(file => ({ id: crypto.randomUUID(), file }));
        setError("");
        setBatchImages(previous => [...previous, ...added]);
    };

    const clearBatch = () => {
        setBatchImages([]);
        setError("");
    };

    const applyAspectRatio = (ratio: number) => {
        setAspectRatio(ratio);
        if (ratio === 0) return; // Free mode - don't change crop

        let newW = naturalSize.w;
        let newH = newW / ratio;
        if (newH > naturalSize.h) {
            newH = naturalSize.h;
            newW = newH * ratio;
        }
        setCrop({
            x: Math.round((naturalSize.w - newW) / 2),
            y: Math.round((naturalSize.h - newH) / 2),
            w: Math.round(newW),
            h: Math.round(newH),
        });
    };

    const rotateLeft = () => setRotation((r) => (r - 90 + 360) % 360);
    const rotateRight = () => setRotation((r) => (r + 90) % 360);
    const resetCrop = () => {
        setCrop({ x: 0, y: 0, w: naturalSize.w, h: naturalSize.h });
        setRotation(0);
        setAspectRatio(0);
    };

    // Mouse/touch handlers
    const handlePointerDown = (e: React.PointerEvent, type: typeof dragging) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(type);
        setStartPos({ x: e.clientX, y: e.clientY });
        setStartCrop({ ...crop });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging) return;

        const imgRect = getImageRect();
        const scale = naturalSize.w / ((rotation === 90 || rotation === 270) ? imgRect.height : imgRect.width);
        if (!Number.isFinite(scale)) return;
        const horizontal = e.clientX - startPos.x;
        const vertical = e.clientY - startPos.y;
        const angle = rotation * Math.PI / 180;
        const dx = (horizontal * Math.cos(angle) + vertical * Math.sin(angle)) * scale;
        const dy = (-horizontal * Math.sin(angle) + vertical * Math.cos(angle)) * scale;

        let newCrop = { ...startCrop };

        if (dragging === "move") {
            newCrop.x = Math.max(0, Math.min(naturalSize.w - startCrop.w, startCrop.x + dx));
            newCrop.y = Math.max(0, Math.min(naturalSize.h - startCrop.h, startCrop.y + dy));
        } else {
            // Resize from corners
            let newX = newCrop.x;
            let newY = newCrop.y;
            let newW = newCrop.w;
            let newH = newCrop.h;

            if (dragging === "se") {
                newW = Math.max(50, startCrop.w + dx);
                newH = Math.max(50, startCrop.h + dy);
            } else if (dragging === "sw") {
                const deltaW = -dx;
                newW = Math.max(50, startCrop.w + deltaW);
                newX = startCrop.x - deltaW;
                newH = Math.max(50, startCrop.h + dy);
            } else if (dragging === "ne") {
                newW = Math.max(50, startCrop.w + dx);
                const deltaH = -dy;
                newH = Math.max(50, startCrop.h + deltaH);
                newY = startCrop.y - deltaH;
            } else if (dragging === "nw") {
                const deltaW = -dx;
                const deltaH = -dy;
                newW = Math.max(50, startCrop.w + deltaW);
                newH = Math.max(50, startCrop.h + deltaH);
                newX = startCrop.x - deltaW;
                newY = startCrop.y - deltaH;
            }

            // Apply aspect ratio constraint if not free
            if (aspectRatio > 0) {
                if (dragging === "se" || dragging === "ne") {
                    newH = newW / aspectRatio;
                } else {
                    newW = newH * aspectRatio;
                }
                if (dragging === "ne") newY = startCrop.y + startCrop.h - newH;
                if (dragging === "nw") {
                    newX = startCrop.x + startCrop.w - newW;
                    newY = startCrop.y + startCrop.h - newH;
                }
                if (dragging === "sw") newX = startCrop.x + startCrop.w - newW;
            }

            // Clamp to bounds
            if (newX < 0) { newW += newX; newX = 0; }
            if (newY < 0) { newH += newY; newY = 0; }
            if (newX + newW > naturalSize.w) newW = naturalSize.w - newX;
            if (newY + newH > naturalSize.h) newH = naturalSize.h - newY;

            newCrop = { x: Math.round(newX), y: Math.round(newY), w: Math.round(newW), h: Math.round(newH) };
        }

        setCrop(newCrop);
    };

    const handlePointerUp = () => {
        setDragging(null);
    };

    const downloadCropped = async () => {
        if (!file || isProcessing || !naturalSize.w) return;
        setError("");
        setIsProcessing(true);
        try {
            const image = await openLocalImage(file);
            const swap = rotation === 90 || rotation === 270;
            const { canvas, context } = makeImageCanvas(Math.round(swap ? crop.h : crop.w), Math.round(swap ? crop.w : crop.h));
            try {
                if (outputFormat === "image/jpeg") {
                    context.fillStyle = "#fff";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                }
                context.translate(canvas.width / 2, canvas.height / 2);
                context.rotate(rotation * Math.PI / 180);
                context.drawImage(image, crop.x, crop.y, crop.w, crop.h, -crop.w / 2, -crop.h / 2, crop.w, crop.h);
                const ext = OUTPUT_FORMATS.find(format => format.value === outputFormat)?.ext ?? "jpg";
                manualOutput.save(await encodeCanvas(canvas, outputFormat, quality / 100), file.name.replace(/\.[^.]+$/, "") + "_cropped." + ext);
            } finally {
                canvas.width = canvas.height = 0;
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not crop this image.");
        } finally {
            setIsProcessing(false);
        }
    };

    const autoCropBatch = async () => {
        if (!batchImages.length || isProcessing) return;
        setError("");
        setIsProcessing(true);
        setProgress(0);
        const ready: { name: string; blob: Blob }[] = [];
        const skipped: string[] = [];
        const names = new Set<string>();
        const ext = OUTPUT_FORMATS.find(format => format.value === outputFormat)?.ext ?? "jpg";
        try {
            for (const [index, { file }] of batchImages.entries()) {
                try {
                    const image = await openLocalImage(file);
                    const w = Math.max(1, Math.min(image.naturalWidth, Math.round(image.naturalHeight * autoAspectRatio)));
                    const h = Math.max(1, Math.min(image.naturalHeight, Math.round(image.naturalWidth / autoAspectRatio)));
                    const { canvas, context } = makeImageCanvas(w, h);
                    try {
                        if (outputFormat === "image/jpeg") {
                            context.fillStyle = "#fff";
                            context.fillRect(0, 0, w, h);
                        }
                        context.drawImage(image, (image.naturalWidth - w) / 2, (image.naturalHeight - h) / 2, w, h, 0, 0, w, h);
                        ready.push({ blob: await encodeCanvas(canvas, outputFormat, quality / 100),
                            name: uniqueImageName(file.name.replace(/\.[^.]+$/, "") + "_cropped." + ext, names) });
                    } finally {
                        canvas.width = canvas.height = 0;
                    }
                } catch {
                    skipped.push(file.name);
                }
                setProgress(Math.round((index + 1) / batchImages.length * 100));
            }
            setBatchOutput({ source: batchImages, files: ready });
            if (ready.length) await downloadAsZip(ready, "cropped_images.zip");
            if (skipped.length) setError("Could not crop: " + skipped.join(", ") + ".");
        } catch {
            setError("Could not create the crop ZIP.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Calculate display crop box (percentage based)
    const cropStyle = naturalSize.w > 0 ? {
        left: `${(crop.x / naturalSize.w) * 100}%`,
        top: `${(crop.y / naturalSize.h) * 100}%`,
        width: `${(crop.w / naturalSize.w) * 100}%`,
        height: `${(crop.h / naturalSize.h) * 100}%`,
    } : {};

    return (
        <ToolWorkspace category="Image tools" backHref="/image" title="Crop Images" description="Crop one image by hand or center-crop a batch to the same aspect ratio.">
          <div className="mx-auto max-w-3xl">
            {/* Mode Toggle */}
            <div className="flex bg-muted rounded-lg p-1 mb-4">
                <button
                    disabled={isProcessing} onClick={() => setMode("manual")}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${mode === "manual" ? "bg-background shadow-sm" : ""}`}
                >
                    <Crop className="h-4 w-4 inline mr-2" />Manual Crop
                </button>
                <button
                    disabled={isProcessing} onClick={() => setMode("auto")}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${mode === "auto" ? "bg-background shadow-sm" : ""}`}
                >
                    <ImageIcon className="h-4 w-4 inline mr-2" />Auto Batch
                </button>
            </div>

            {mode === "manual" ? (
                <>
                    {!file ? (
                        <FilePicker accept="image/*" action="Choose image" hint="Or drop an image here." disabled={isProcessing}
                            onFiles={files => files.length === 1 ? handleFile(files[0]) : setError("Choose one image.")} />
                    ) : (
                        <>
                            <div className="border rounded-xl p-4 mb-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="min-w-0 flex-1"><ToolFile blob={file} name={file.name} /></div>
                                    <Button variant="ghost" size="sm" aria-label="Remove image" disabled={isProcessing} onClick={() => { setFile(null); setImageUrl(null); setError(""); }}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Interactive Crop Area */}
                                <div
                                    ref={containerRef}
                                    className="relative bg-black rounded-lg overflow-hidden select-none touch-none"
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerLeave={handlePointerUp}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element -- Local file previews stay in the browser. */}
                                    <img
                                        ref={imgRef}
                                        src={imageUrl || ""}
                                        alt="Preview"
                                        className="w-full h-auto max-h-96 object-contain"
                                        style={{ transform: `rotate(${rotation}deg)` }}
                                        draggable={false}
                                    />

                                    {/* Dark overlay with crop hole */}
                                    {naturalSize.w > 0 && (
                                        <div className="absolute inset-0">
                                            {/* Full dark overlay */}
                                            <div className="absolute inset-0 bg-black/50" />

                                            {/* Clear crop area (punch through) */}
                                            <div
                                                className="absolute bg-transparent border-2 border-white shadow-lg cursor-move"
                                                style={{
                                                    ...cropStyle,
                                                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                                                }}
                                                onPointerDown={(e) => handlePointerDown(e, "move")}
                                            >
                                                {/* Grid lines */}
                                                <div className="absolute inset-0 pointer-events-none">
                                                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                                                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                                                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                                                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                                                </div>

                                                {/* Move indicator */}
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <Move className="h-5 w-5 text-white/60 drop-shadow" />
                                                </div>

                                                {/* Resize handles - all 4 corners */}
                                                <div
                                                    className="absolute -left-2 -top-2 w-4 h-4 bg-white rounded-sm cursor-nw-resize shadow-md"
                                                    onPointerDown={(e) => handlePointerDown(e, "nw")}
                                                />
                                                <div
                                                    className="absolute -right-2 -top-2 w-4 h-4 bg-white rounded-sm cursor-ne-resize shadow-md"
                                                    onPointerDown={(e) => handlePointerDown(e, "ne")}
                                                />
                                                <div
                                                    className="absolute -left-2 -bottom-2 w-4 h-4 bg-white rounded-sm cursor-sw-resize shadow-md"
                                                    onPointerDown={(e) => handlePointerDown(e, "sw")}
                                                />
                                                <div
                                                    className="absolute -right-2 -bottom-2 w-4 h-4 bg-white rounded-sm cursor-se-resize shadow-md"
                                                    onPointerDown={(e) => handlePointerDown(e, "se")}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Crop info */}
                                <div className="mt-3 text-xs text-muted-foreground text-center">
                                    Crop: {crop.w} × {crop.h} px {aspectRatio === 0 && "(Free)"}
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="border rounded-xl p-4 mb-4 space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" aria-label="Rotate left" onClick={rotateLeft}><RotateCcw className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="sm" aria-label="Rotate right" onClick={rotateRight}><RotateCw className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="sm" onClick={resetCrop}><RefreshCcw className="h-4 w-4 mr-1" />Reset</Button>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-2 block">Aspect Ratio</label>
                                    <div className="flex flex-wrap gap-2">
                                        {ASPECT_RATIOS.map((r) => (
                                            <Button
                                                key={r.label}
                                                variant={aspectRatio === r.value ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => applyAspectRatio(r.value)}
                                            >
                                                {r.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Format</label>
                                        <select
                                            value={outputFormat}
                                            onChange={(e) => setOutputFormat(e.target.value)}
                                            className="w-full p-2 border rounded-lg text-sm"
                                        >
                                            {OUTPUT_FORMATS.map((f) => (
                                                <option key={f.value} value={f.value}>{f.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {outputFormat === "image/jpeg" && (
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Quality: {quality}%</label>
                                            <input
                                                type="range"
                                                value={quality}
                                                onChange={(e) => setQuality(parseInt(e.target.value))}
                                                min={10}
                                                max={100}
                                                className="w-full"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Button onClick={downloadCropped} disabled={isProcessing || !naturalSize.w || !crop.w || !crop.h} className="w-full h-11">
                                <Download className="h-4 w-4 mr-2" />Crop & Download
                            </Button>
                        </>
                    )}
                </>
            ) : (
                <>
                    <FilePicker multiple accept="image/*" action={batchImages.length ? "Add images" : "Choose images"}
                        hint="Or drop images for a batch crop." disabled={isProcessing} onFiles={addBatchImages} />

                    {batchImages.length > 0 && (
                        <div className="border rounded-xl p-4 mb-4">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-sm font-medium">{batchImages.length} images</span>
                                <Button variant="ghost" size="sm" disabled={isProcessing} onClick={clearBatch}>Clear</Button>
                            </div>
                            <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                                {batchImages.map(img => <ToolFile key={img.id} blob={img.file} name={img.file.name} />)}
                            </div>
                        </div>
                    )}

                    <div className="border rounded-xl p-4 mb-4">
                        <label className="text-sm font-medium mb-2 block">Crop Aspect Ratio (from center)</label>
                        <div className="flex flex-wrap gap-2">
                            {ASPECT_RATIOS.slice(1).map((r) => (
                                <Button
                                    key={r.label}
                                    variant={autoAspectRatio === r.value ? "default" : "outline"}
                                    size="sm"
                                    disabled={isProcessing} onClick={() => setAutoAspectRatio(r.value)}
                                >
                                    {r.label}
                                </Button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">All images will be cropped from center to match the ratio</p>
                    </div>

                    <label className="mb-3 block text-sm font-medium">Batch output format
                        <select aria-label="Batch output format" value={outputFormat} disabled={isProcessing} onChange={event => setOutputFormat(event.target.value)} className="mt-2 block h-10 w-full rounded border bg-background px-3">
                            {OUTPUT_FORMATS.map(format => <option key={format.value} value={format.value}>{format.label}</option>)}
                        </select>
                    </label>
                    {isProcessing && <Progress value={progress} aria-label="Crop progress" className="h-1.5 mb-4" />}

                    <Button onClick={autoCropBatch} disabled={isProcessing || batchImages.length === 0} className="w-full h-11">
                        <Download className="h-4 w-4 mr-2" />{isProcessing ? "Processing..." : "Batch Crop & Download ZIP"}
                    </Button>
                </>
            )}

            <div className="mt-4">
                <ToolPanel stage="result" title="Results">
                    {results.length ? <div className="grid gap-2">
                        {results.map(result => <div key={result.name} className="flex items-center gap-2">
                            <div className="min-w-0 flex-1"><ToolFile blob={result.blob} name={result.name} /></div>
                            <Button variant="outline" size="icon" aria-label={"Download " + result.name} onClick={() => downloadFile(result.blob, result.name)}><Download /></Button>
                        </div>)}
                    </div> : <EmptyOutput />}
                </ToolPanel>
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          </div>
        </ToolWorkspace>
    );
}
