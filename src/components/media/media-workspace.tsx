"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Play } from "lucide-react";
import { ToolFile } from "@/components/layout/tool-file";
import { EmptyOutput, ViewToolResult } from "@/components/layout/tool-output";
import { useThumbnails } from "@/components/layout/thumbnail-preference";
import { ToolWorkspace, ToolPanel } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { downloadFile, formatBytes } from "@/lib/download-manager";
import { extractVideoFrame, recordVideo } from "@/lib/video-utils";
import { exportWav } from "@/lib/audio-export";

const tools = {
  "video-compress": ["Compress video", "Choose a resolution and bitrate, then compare the result with your original."],
  "video-convert": ["Convert video", "Export a WebM video using a browser-supported codec."],
  "video-trim": ["Trim video", "Mark the start and end, preview your selection, and save the clip."],
  frame: ["Extract a video frame", "Choose a moment in the video and export one still image."],
  "audio-convert": ["Convert audio", "Save audio as WAV with your choice of bit depth and channels."],
  "audio-trim": ["Trim audio", "Select and listen to a range, then save it as a WAV clip."],
  "extract-audio": ["Extract audio", "Save the decoded audio track from a video as WAV."],
} as const;
type Mode = keyof typeof tools;
type Asset = { file: File; url: string };
type Result = { blob: Blob; url: string; name: string; original: boolean };

export function MediaWorkspace({ mode }: { mode: Mode }) {
  const thumbnails = useThumbnails();
  const [source, setSource] = useState<Asset | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("");
  const [codec, setCodec] = useState("vp8");
  const [height, setHeight] = useState("720");
  const [bitrate, setBitrate] = useState("1200");
  const [fps, setFps] = useState("30");
  const [depth, setDepth] = useState("16");
  const [mono, setMono] = useState(false);
  const [normalize, setNormalize] = useState(false);
  const [still, setStill] = useState("png");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const stopped = useRef(false);
  const clipEnd = useRef<number | null>(null);
  const player = useRef<HTMLMediaElement | null>(null);
  const video = mode.startsWith("video") || mode === "frame" || mode === "extract-audio";
  const trimming = mode.endsWith("trim");
  const compressing = mode === "video-compress";
  const frame = mode === "frame";
  const wav = mode.startsWith("audio") || mode === "extract-audio";
  const [title, intro] = tools[mode];

  useEffect(() => {
    const url = source?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [source]);

  useEffect(() => {
    const url = result?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [result]);

  useEffect(() => () => { stopped.current = true; }, []);

  function choose(files: File[]) {
    if (files.length !== 1 || !files[0].size) { setError("Choose one non-empty " + (video ? "video." : "audio file.")); return; }
    clipEnd.current = null;
    setSource({ file: files[0], url: URL.createObjectURL(files[0]) });
    setDuration(0);
    setStart("0");
    setEnd("");
    setResult(null);
    setError("");
    setStatus("");
  }

  const from = Number(start);
  const to = end === "" ? duration : Number(end);
  const validTime = Number.isFinite(from) && from >= 0 && from < duration && (!trimming || Number.isFinite(to) && to > from && to <= duration);

  function preview() {
    if (!player.current || !validTime) return;
    clipEnd.current = to;
    player.current.currentTime = from;
    void player.current.play().catch(() => setError("The browser could not play this clip."));
  }

  async function run() {
    if (!source || busy || ((trimming || frame) && !validTime)) return;
    setBusy(true);
    setError("");
    setStatus("");
    setProgress(0);
    stopped.current = false;
    player.current?.pause();
    try {
      let blob: Blob;
      let suffix: string;
      let extension: string;
      if (frame) {
        extension = still === "jpeg" ? "jpg" : "png";
        suffix = "_frame";
        blob = await extractVideoFrame(source.file, from, "image/" + still);
      } else if (wav) {
        extension = "wav";
        suffix = trimming ? "_clip" : mode === "extract-audio" ? "_audio" : "_converted";
        blob = await exportWav(source.file, { start: trimming ? from : 0, end: trimming ? to : undefined, depth: Number(depth), mono, normalize });
      } else {
        extension = "webm";
        suffix = trimming ? "_clip" : compressing ? "_compressed" : "_converted";
        blob = await recordVideo(source.file, {
          mimeType: "video/webm;codecs=" + codec + ",opus", fps: Number(fps),
          maxHeight: compressing ? Number(height) : undefined, bitrate: compressing ? Number(bitrate) * 1000 : undefined,
          start: trimming ? from : undefined, end: trimming ? to : undefined,
          cancelled: () => stopped.current, onProgress: setProgress,
        });
      }
      if (stopped.current) { setStatus("Export cancelled."); return; }
      const original = compressing && blob.size >= source.file.size;
      const output = original ? source.file : blob;
      setResult({ blob: output, url: URL.createObjectURL(output), name: original ? source.file.name : source.file.name.replace(/\.[^.]+$/, "") + suffix + "." + extension, original });
      setStatus(original ? "The original is the smallest result." : "Ready to download.");
    } catch (reason) {
      if (stopped.current) setStatus("Export cancelled.");
      else setError(reason instanceof Error ? reason.message : "Could not process this file.");
    } finally {
      setBusy(false);
    }
  }

  const playerEvents = {
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      const length = event.currentTarget.duration;
      setDuration(Number.isFinite(length) ? length : 0);
    },
    onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      if (clipEnd.current !== null && event.currentTarget.currentTime >= clipEnd.current) {
        event.currentTarget.pause();
        clipEnd.current = null;
      }
    },
    onError: () => { if (trimming || frame || !wav) setError("This browser could not play the selected file."); },
  };

  return (
    <ToolWorkspace category="Media tools" backHref="/media" title={title} description={intro}>
      <div className="studio-flow">
        <ToolPanel stage="input" title={video ? "Source video" : "Source audio"} action={source && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setSource(null); setResult(null); setStatus(""); setError(""); }}>Remove</Button>}>
          {source ? <div className="space-y-3">
            <ToolFile blob={source.file} name={source.file.name} detail={duration > 0 ? duration.toFixed(2) + " s" : undefined} />
            <div hidden={!thumbnails}>
              {video ? <video key={source.url} ref={node => { player.current = node; }} {...playerEvents} src={source.url} controls playsInline preload="metadata" className="max-h-[28rem] w-full rounded-2xl bg-[#161b24]" /> :
                <audio key={source.url} ref={node => { player.current = node; }} {...playerEvents} src={source.url} controls preload="metadata" className="w-full" />}
            </div>
            <details className="rounded-xl border px-3 py-2.5"><summary className="cursor-pointer text-sm font-medium">Replace file</summary><div className="mt-3">
              <FilePicker accept={video ? "video/*" : "audio/*"} disabled={busy} action="Choose replacement" hint="Or drop a replacement file here." onFiles={choose} />
            </div></details>
          </div> : (
            <FilePicker accept={video ? "video/*" : "audio/*"} action={video ? "Choose video" : "Choose audio"} hint="Or drop a file here." onFiles={choose} />
          )}
        </ToolPanel>
        <ToolPanel stage="settings" title="Export settings">
          <fieldset disabled={!source || busy} className="space-y-4">
            {(trimming || frame) && <>
              {duration === 0 && source && <p className="text-sm text-muted-foreground">Waiting for a readable media duration.</p>}
              {duration > 0 && <label className="block rounded-xl bg-accent p-3 text-sm font-medium">
                {frame ? "Frame position" : "Clip start position"}
                <input type="range" min="0" max={Math.max(0, duration - 0.001)} step="0.01" value={Math.min(duration, Math.max(0, from || 0))}
                  className="mt-3 block w-full accent-primary" onChange={event => {
                    setStart(event.target.value);
                    if (player.current) {
                      clipEnd.current = null;
                      player.current.pause();
                      player.current.currentTime = Number(event.target.value);
                    }
                  }} />
              </label>}
              <div className={trimming ? "grid grid-cols-2 gap-3" : undefined}>
                <label className="block text-sm font-medium">{frame ? "Frame time (s)" : "Start (s)"}<Input className="mt-2" type="number" step="0.01" min="0" max={duration} value={start} onChange={e => setStart(e.target.value)} /></label>
                {trimming && <label className="block text-sm font-medium">End (s)<Input className="mt-2" type="number" step="0.01" min="0" max={duration} placeholder={duration.toFixed(2)} value={end} onChange={e => setEnd(e.target.value)} /></label>}
              </div>
              {trimming && <Button variant="outline" disabled={!validTime} onClick={preview}><Play />Preview range</Button>}
              {frame && thumbnails && <Button variant="outline" disabled={!duration} onClick={() => setStart(String(player.current?.currentTime ?? 0))}><ImageIcon aria-hidden="true" />Use playhead time</Button>}
            </>}
            {frame ? <label className="block text-sm font-medium">Image format<select aria-label="Image format" className="mt-2 block h-10 w-full rounded-xl border bg-background px-3" value={still} onChange={e => setStill(e.target.value)}><option value="png">PNG</option><option value="jpeg">JPEG</option></select></label> : wav ? <>
              <label className="block text-sm font-medium">WAV bit depth<select aria-label="WAV bit depth" className="mt-2 block h-10 w-full rounded-xl border bg-background px-3" value={depth} onChange={e => setDepth(e.target.value)}><option value="16">16-bit PCM</option><option value="24">24-bit PCM</option></select></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mono} onChange={e => setMono(e.target.checked)} className="accent-primary" />Mix to mono</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={normalize} onChange={e => setNormalize(e.target.checked)} className="accent-primary" />Normalize peak volume</label>
            </> : <>
              <label className="block text-sm font-medium">WebM codec<select aria-label="WebM codec" className="mt-2 block h-10 w-full rounded-xl border bg-background px-3" value={codec} onChange={e => setCodec(e.target.value)}><option value="vp8">VP8 + Opus</option><option value="vp9">VP9 + Opus</option></select></label>
              <label className="block text-sm font-medium">Frame rate<select aria-label="Frame rate" className="mt-2 block h-10 w-full rounded-xl border bg-background px-3" value={fps} onChange={e => setFps(e.target.value)}>{[24, 25, 30, 60].map(n => <option key={n}>{n}</option>)}</select></label>
              {compressing && <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">Max height<select aria-label="Max height" className="mt-2 block h-10 w-full rounded-xl border bg-background px-3" value={height} onChange={e => setHeight(e.target.value)}>{[360, 480, 720, 1080, 2160].map(n => <option key={n} value={n}>{n}p</option>)}</select></label>
                <label className="block text-sm font-medium">Bitrate<select aria-label="Bitrate" className="mt-2 block h-10 w-full rounded-xl border bg-background px-3" value={bitrate} onChange={e => setBitrate(e.target.value)}>{[400, 800, 1200, 2000, 4000].map(n => <option key={n} value={n}>{n} kb/s</option>)}</select></label>
              </div>}
              <p className="text-sm text-muted-foreground">Export runs at playback speed. Keep this tab open until it finishes.</p>
            </>}
          </fieldset>
          <Button size="lg" className="mt-5 w-full" disabled={!source || busy || ((trimming || frame) && !validTime)} onClick={run}>{busy ? "Exporting…" : frame ? "Extract frame" : wav ? "Export WAV" : compressing ? "Compress video" : "Export WebM"}</Button>
          {busy && !wav && !frame && <div className="mt-3 space-y-3"><Progress value={progress} aria-label="Export progress" /><Button size="sm" variant="outline" onClick={() => { stopped.current = true; }}>Cancel export</Button></div>}
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          {result && !busy && <ViewToolResult />}
        </ToolPanel>
        <ToolPanel stage="result" title="Result">
          {result ? <>
            <ToolFile blob={result.blob} name={result.name} detail={result.original ? "Original retained" : undefined} />
            <dl className="my-3 flex flex-wrap gap-x-7 gap-y-2 text-sm">
              <div><dt className="text-muted-foreground">Original</dt><dd className="font-semibold">{formatBytes(source?.file.size ?? 0)}</dd></div>
              <div><dt className="text-muted-foreground">Download size</dt><dd className="font-semibold">{formatBytes(result.blob.size)}</dd></div>
            </dl>
            {thumbnails && (wav ? <audio src={result.url} controls preload="metadata" className="w-full" /> : frame ?
              // eslint-disable-next-line @next/next/no-img-element -- The preview uses a local blob.
              <img src={result.url} alt="Extracted frame" className="max-h-80 rounded-xl object-contain" /> :
              <video src={result.url} controls playsInline preload="metadata" className="max-h-80 w-full rounded-xl bg-[#161b24]" />)}
            <Button className="mt-4" onClick={() => downloadFile(result.blob, result.name)}><Download />{result.original ? "Download original" : "Download " + result.name.split(".").at(-1)?.toUpperCase()}</Button>
          </> : <EmptyOutput />}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
