"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { EmptyOutput, ViewToolResult } from "@/components/layout/tool-output";
import { ToolFile } from "@/components/layout/tool-file";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { useThumbnails } from "@/components/layout/thumbnail-preference";
import { useBlobUrl } from "@/components/layout/use-blob-url";
import { convertAudio } from "@/lib/audio-export";
import { downloadFile } from "@/lib/download-manager";
import { fileStem } from "@/lib/file-utilities";

const formats = [
  { extension: "wav", label: "WAV", mime: "audio/wav" },
  { extension: "webm", label: "WebM (Opus)", mime: "audio/webm;codecs=opus" },
  { extension: "ogg", label: "OGG (Opus)", mime: "audio/ogg;codecs=opus" },
] as const;

export default function AudioConverterPage() {
  const [source, setSource] = useState<File | null>(null);
  const [format, setFormat] = useState<(typeof formats)[number]["extension"]>("wav");
  const [sampleRate, setSampleRate] = useState(44100);
  const [channels, setChannels] = useState<1 | 2>(2);
  const [depth, setDepth] = useState<8 | 16 | 24 | 32>(16);
  const [normalize, setNormalize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ name: string; blob: Blob }>();
  const thumbnails = useThumbnails();
  const preview = useBlobUrl(thumbnails ? result?.blob : undefined);

  async function run() {
    if (!source || busy) return;
    const settings = formats.find(item => item.extension === format)!;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const blob = await convertAudio(source, { sampleRate, channels, normalize, depth, mime: settings.mime });
      setResult({ name: fileStem(source.name) + "." + settings.extension, blob });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not convert this audio file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="Convert tools" backHref="/convert" title="Audio Converter" description="Export WAV or a compressed Opus file using your browser.">
      <div className="studio-flow">
        <ToolPanel stage="input" title="Source audio">
          {source && <div className="mb-3"><ToolFile blob={source} name={source.name} /></div>}
          <FilePicker accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a,.aac,.flac,.opus" disabled={busy}
            action={source ? "Replace audio" : "Choose audio"} hint="Or drop an audio file here." onFiles={files => {
              setSource(files[0]); setResult(undefined); setError("");
            }} />
        </ToolPanel>
        <ToolPanel stage="settings" title="Audio format">
          <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Output format
              <select className="mt-1 block w-full rounded-lg border bg-background p-2" aria-label="Output format" value={format} onChange={event => setFormat(event.target.value as typeof format)}>
                {formats.map(item => <option key={item.extension} value={item.extension}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Sample rate (Hz)
              <select className="mt-1 block w-full rounded-lg border bg-background p-2" aria-label="Sample rate (Hz)" value={sampleRate} onChange={event => setSampleRate(Number(event.target.value))}>
                {[8000, 16000, 22050, 44100, 48000].map(rate => <option key={rate}>{rate}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Channels
              <select className="mt-1 block w-full rounded-lg border bg-background p-2" aria-label="Channels" value={channels} onChange={event => setChannels(event.target.value === "1" ? 1 : 2)}>
                <option value="1">Mono</option><option value="2">Stereo</option>
              </select>
            </label>
            {format === "wav" && <label className="text-sm font-medium">Bit depth
              <select className="mt-1 block w-full rounded-lg border bg-background p-2" aria-label="Bit depth" value={depth} onChange={event => setDepth(Number(event.target.value) as typeof depth)}>
                {[8, 16, 24, 32].map(bits => <option key={bits} value={bits}>{bits === 32 ? "32-bit float" : bits + "-bit PCM"}</option>)}
              </select>
            </label>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={normalize} onChange={event => setNormalize(event.target.checked)} />Normalize peak volume</label>
          </fieldset>
          <Button className="mt-4 w-full" disabled={!source || busy} onClick={run}>{busy ? "Converting…" : "Convert audio"}</Button>
          {busy && format !== "wav" && <p role="status" className="mt-2 text-sm text-muted-foreground">Opus encoding runs at playback speed.</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          {result && <ViewToolResult />}
        </ToolPanel>
        <ToolPanel stage="result" title="Converted audio">
          {result ? <div className="space-y-3">
            <ToolFile blob={result.blob} name={result.name} />
            {preview && <audio controls preload="metadata" src={preview} className="w-full" />}
            <Button onClick={() => downloadFile(result.blob, result.name)}><Download />Download audio</Button>
          </div> : <EmptyOutput />}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}
