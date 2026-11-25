"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyOutput } from "@/components/layout/tool-output";
import { ToolPanel } from "@/components/layout/tool-workspace";

export function AiTextResult({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState("");
  const [error, setError] = useState(false);
  return (
    <ToolPanel stage="result" title={title} action={text &&
      <Button variant="outline" onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(text); setError(false); }
        catch { setError(true); }
      }}><Copy />{copied === text ? "Copied" : "Copy"}</Button>}>
      {text ? <p className="whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed" aria-live="polite">{text}</p> :
        <EmptyOutput>Gemini’s response will appear here.</EmptyOutput>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">Could not access the clipboard.</p>}
    </ToolPanel>
  );
}
