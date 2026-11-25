"use client";

import { useState, useSyncExternalStore } from "react";
import { ExternalLink, FileText, Image, KeyRound, MessageSquare, Sparkles, Wand2 } from "lucide-react";
import { UtilityDirectory } from "@/components/layout/utility-directory";
import { ToolPanel } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearApiKey, hasApiKey, setApiKey, subscribeToApiKey } from "@/lib/gemini";
import type { DirectoryGroup } from "@/lib/tool-directory";

const groups: DirectoryGroup[] = [
  { title: "Text", icon: MessageSquare, tone: "purple", tools: [
    { name: "Chat", description: "Ask questions and continue a conversation.", href: "/ai/chat", icon: MessageSquare },
    { name: "Summarize", description: "Turn a longer passage into an overview.", href: "/ai/summarize", icon: FileText },
  ] },
  { title: "Images", icon: Image, tone: "blue", tools: [
    { name: "Describe Image", description: "Ask Gemini what it sees in an image.", href: "/ai/describe-image", icon: Image },
    { name: "Generate Metadata", description: "Write titles, descriptions, and keywords for images.", href: "/ai/generate-metadata", icon: Wand2 },
  ] },
];

export default function AIHubPage() {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const configured = useSyncExternalStore(subscribeToApiKey, hasApiKey, () => false);

  return (
    <UtilityDirectory tone="ai" title="AI tools" description="Chat, summarize text, or work with images using your Google Gemini API key." icon={Sparkles} groups={groups}>
      <ToolPanel title="Google Gemini API key" description="Your key is saved in this browser. When you run an AI tool, the selected content is sent directly to Google Gemini.">
        {configured ? <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 text-sm font-medium" role="status"><KeyRound size={17} aria-hidden="true" />API key configured</p>
          <Button variant="outline" onClick={() => { try { clearApiKey(); setError(""); } catch { setError("Could not remove the API key from browser storage."); } }}>Remove key</Button>
        </div> : <form className="max-w-2xl space-y-2" onSubmit={event => {
          event.preventDefault();
          if (!key.trim()) return;
          try { setApiKey(key.trim()); setKey(""); setShow(false); setError(""); }
          catch { setError("Could not save the API key in this browser."); }
        }}>
          <label htmlFor="gemini-key" className="text-sm font-medium">API key</label>
          <div className="flex flex-wrap gap-2">
            <Input id="gemini-key" type={show ? "text" : "password"} className="min-w-0 flex-1 basis-44" value={key} autoComplete="off" spellCheck={false} onChange={event => setKey(event.target.value)} />
            <Button type="button" variant="outline" onClick={() => setShow(current => !current)}>{show ? "Hide" : "Show"}</Button>
            <Button disabled={!key.trim()}>Save key</Button>
          </div>
        </form>}
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm underline underline-offset-4">Get a key from Google AI Studio<ExternalLink size={14} aria-hidden="true" /></a>
      </ToolPanel>
    </UtilityDirectory>
  );
}
