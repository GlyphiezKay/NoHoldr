"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Textarea } from "@/components/ui/textarea";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { ToolFile } from "@/components/layout/tool-file";
import { AiTextResult } from "@/components/layout/ai-text-result";
import { AI_IMAGE_ACCEPT, AI_IMAGE_HINT, describeImage, getErrorMessage, validAiImage } from "@/lib/gemini";

export default function DescribeImagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (!file || busy) return;
    setBusy(true); setError(""); setAnswer("");
    try { setAnswer(await describeImage(file, prompt.trim() || "Describe the important objects, text, colors, and composition in this image.")); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  return (
    <ToolWorkspace category="AI tools" backHref="/ai" title="Describe Image" description="Send a selected image and question to Google Gemini." thumbnails>
      <div className="studio-flow">
        <ToolPanel stage="input" title="Source image">
          {file && <div className="mb-3"><ToolFile blob={file} name={file.name} /></div>}
          <FilePicker accept={AI_IMAGE_ACCEPT} disabled={busy} action={file ? "Replace image" : "Choose image"} hint={AI_IMAGE_HINT} onFiles={files => {
            if (!validAiImage(files[0])) { setError(AI_IMAGE_HINT); return; }
            setFile(files[0]); setAnswer(""); setError("");
          }} />
        </ToolPanel>
        <ToolPanel stage="settings" title="What should Gemini look for?">
          <label className="block text-sm font-medium">Custom prompt (optional)
            <Textarea value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={4000} disabled={busy}
              className="mt-2 min-h-28" placeholder="Describe the color palette." />
          </label>
          <Button className="mt-3 w-full" disabled={!file || busy} onClick={run}>{busy ? "Analyzing…" : "Describe Image"}</Button>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
        <AiTextResult title="Description" text={answer} />
      </div>
    </ToolWorkspace>
  );
}
