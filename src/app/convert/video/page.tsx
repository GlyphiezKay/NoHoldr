"use client";

import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { ToolFile } from "@/components/layout/tool-file";
import { EmptyOutput, ViewToolResult } from "@/components/layout/tool-output";
import { useBlobUrl } from "@/components/layout/use-blob-url";
import { useThumbnails } from "@/components/layout/thumbnail-preference";
import { downloadFile } from "@/lib/download-manager";
import { fileStem } from "@/lib/file-utilities";
import { useState } from "react";
import { recordVideo, extractVideoFrame } from "@/lib/video-utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

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

export default function VideoConverterPage() {
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<{ blob: Blob; name: string }>();
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [targetFormat, setTargetFormat] = useState("webm-vp9");
    const [bitrate, setBitrate] = useState(5000000);
    const [duration, setDuration] = useState(0);
    const [resolution, setResolution] = useState<"original" | "720" | "480" | "360">("original");
    const [frameTime, setFrameTime] = useState(0);
    const [fps, setFps] = useState(30);
    const [error, setError] = useState("");

    const show = useThumbnails();
    const sourceUrl = useBlobUrl(file);
    const resultUrl = useBlobUrl(show ? result?.blob : undefined);

    function choose(files: File[]) {
        setFile(files[0]);
        setResult(undefined);
        setDuration(0);
        setFrameTime(0);
        setError("");
    }

    const extractFrame = (): Promise<Blob> => extractVideoFrame(file!, frameTime, targetFormat === "frame-png" ? "image/png" : "image/jpeg");

    const convertToWebm = (): Promise<Blob> => recordVideo(file!, { mimeType: targetFormat === "webm-vp8" ? "video/webm;codecs=vp8,opus" : "video/webm;codecs=vp9,opus", fps, bitrate, maxHeight: resolution === "original" ? undefined : Number(resolution), onProgress: p => setProgress(10 + p * 0.9) });

    const convertVideo = async () => {
        if (!file) return;
        setIsProcessing(true); setProgress(10); setError(""); setResult(undefined);

        try {
            let blob: Blob;
            if (targetFormat.startsWith("frame-")) {
                blob = await extractFrame();

            } else {
                blob = await convertToWebm();
            }
            const format = OUTPUT_FORMATS.find(item => item.value === targetFormat)!;
            setResult({ blob, name: fileStem(file.name) + "." + format.ext });
            setProgress(100);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not convert the video.");
        } finally {
            setIsProcessing(false);
        }
    };

    const isFrame = targetFormat.startsWith("frame-");
    const isWebm = targetFormat.startsWith("webm-");

    return (
        <ToolWorkspace category="Convert tools" backHref="/convert" title="Video Converter" description="Convert video to WebM or export an individual frame.">
      <div className="studio-flow">
        <ToolPanel stage="input" title="Source video">
          {file && <div className="mb-3"><ToolFile blob={file} name={file.name} /></div>}
          <FilePicker accept="video/*,.mp4,.mov,.avi,.mkv,.webm" action={file ? "Replace video" : "Choose video"}
            hint="Or drop a video here." disabled={isProcessing} onFiles={choose} />
          {sourceUrl && <video src={sourceUrl} controls preload="metadata" playsInline hidden={!show}
            className="mt-3 max-h-80 w-full rounded-xl bg-black" onLoadedMetadata={event => {
              setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
            }} onError={() => setError("This browser could not read the video.")} />}
        </ToolPanel>
        <ToolPanel stage="settings" title="Output settings">
          <fieldset disabled={isProcessing} className="space-y-3">
            <label className="block text-sm font-medium">Output format
              <Select value={targetFormat} onValueChange={setTargetFormat}><SelectTrigger aria-label="Output format" className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{OUTPUT_FORMATS.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            {isWebm && <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-sm">Resolution<select className="mt-1 block w-full rounded-lg border bg-background p-2" value={resolution} onChange={event => setResolution(event.target.value as typeof resolution)}>
                <option value="original">Original</option>{[720,480,360].map(height => <option key={height} value={height}>{height}p</option>)}
              </select></label>
              <label className="text-sm">Bitrate<select className="mt-1 block w-full rounded-lg border bg-background p-2" value={bitrate} onChange={event => setBitrate(Number(event.target.value))}>
                {BITRATES.map(rate => <option key={rate.value} value={rate.value}>{rate.label}</option>)}
              </select></label>
              <label className="text-sm">Frame rate<select className="mt-1 block w-full rounded-lg border bg-background p-2" value={fps} onChange={event => setFps(Number(event.target.value))}>
                {[24,25,30,60].map(rate => <option key={rate}>{rate}</option>)}
              </select></label>
            </div>}
            {isFrame && <label className="block text-sm font-medium">Frame time (s)
              <input type="number" min={0} max={duration || undefined} step={0.001} value={frameTime} onChange={event => setFrameTime(Number(event.target.value))}
                className="mt-1 block w-full rounded-lg border bg-background p-2" />
            </label>}
          </fieldset>
          <Button className="mt-4 w-full" disabled={!file || isProcessing || (isFrame && (frameTime < 0 || (duration > 0 && frameTime >= duration)))} onClick={convertVideo}>
            {isProcessing ? "Converting…" : isFrame ? "Extract frame" : "Convert video"}
          </Button>
          {isProcessing && <Progress aria-label="Conversion progress" className="mt-3" value={progress} />}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          {result && <ViewToolResult />}
        </ToolPanel>
        <ToolPanel stage="result" title="Converted file">
          {result ? <div className="space-y-3">
            <ToolFile blob={result.blob} name={result.name} />
            {resultUrl && result.blob.type.startsWith("video/") && <video src={resultUrl} controls playsInline preload="metadata" className="max-h-80 w-full rounded-xl bg-black" />}
            <Button onClick={() => downloadFile(result.blob, result.name)}><Download />Download result</Button>
          </div> : <EmptyOutput />}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
