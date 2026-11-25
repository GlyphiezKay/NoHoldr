"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { AiTextResult } from "@/components/layout/ai-text-result";
import { generateWithSystem, getErrorMessage } from "@/lib/gemini";

export default function SummarizePage() {
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function summarize() {
    if (!input.trim() || busy) return;
    setBusy(true); setError(""); setSummary("");
    try {
      setSummary(await generateWithSystem("Summarize the user's passage clearly and concisely in its original language. Keep the key facts and avoid adding information.", input.trim()));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="AI tools" backHref="/ai" title="Summarize" description="Send a passage to Google Gemini and get an overview.">
      <div className="grid gap-5">
        <ToolPanel stage="input" title="Source text">
          <label className="block text-sm font-medium">Text to summarize
            <Textarea value={input} onChange={event => setInput(event.target.value)} disabled={busy} className="mt-2 min-h-48" placeholder="Paste your text here…" />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{input.length.toLocaleString()} characters</span>
            <Button onClick={summarize} disabled={!input.trim() || busy}>{busy ? "Summarizing…" : "Summarize"}</Button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </ToolPanel>
        <AiTextResult title="Summary" text={summary} />
      </div>
    </ToolWorkspace>
  );
}
