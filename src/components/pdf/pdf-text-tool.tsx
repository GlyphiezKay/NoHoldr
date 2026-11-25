"use client";

import { useState } from "react";
import Link from "next/link";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Textarea } from "@/components/ui/textarea";
import { downloadFile } from "@/lib/download-manager";
import { readPdfLines } from "@/lib/pdf-export";

const languages = { en: "English", id: "Indonesian", es: "Spanish", fr: "French", de: "German", ja: "Japanese", zh: "Chinese (Simplified)" };
type Language = keyof typeof languages;
type TranslationPair = { sourceLanguage: Language; targetLanguage: Language };
type LocalTranslator = {
  availability(pair: TranslationPair): Promise<string>;
  create(options: TranslationPair & { monitor?: (monitor: EventTarget) => void }): Promise<{ translate(text: string): Promise<string>; destroy(): void }>;
};

const ignoredWords = new Set("the and that this from with into are was were have had for not you your all yang dan dari ini itu pada untuk dalam dengan tidak sudah akan oleh sebagai adalah juga atau bisa".split(" "));
function keywords(text: string) {
  return (text.toLowerCase().match(/\p{L}{3,}/gu) ?? []).filter(word => !ignoredWords.has(word));
}

function summarize(text: string, max: number) {
  const sentences = text.split(/(?<=[.!?])\s+|\n{2,}/).map(item => item.trim()).filter(Boolean);
  const counts = new Map<string, number>();
  for (const word of keywords(text)) counts.set(word, (counts.get(word) ?? 0) + 1);
  return sentences.map((sentence, index) => {
    const words = [...new Set(keywords(sentence))];
    const score = words.reduce((total, word) => total + Math.log(1 + (counts.get(word) ?? 0)), 0) / Math.sqrt(Math.max(words.length, 1));
    return { sentence, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, max).sort((a, b) => a.index - b.index).map(item => item.sentence).join("\n\n");
}

export function PdfTextTool({ translate }: { translate?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<Language>("en");
  const [targetLanguage, setTargetLanguage] = useState<Language>("id");
  const [length, setLength] = useState("5");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (!file || busy) return;
    setBusy(true);
    setResult("");
    setError("");
    setStatus("Opening PDF…");
    let translator: Awaited<ReturnType<LocalTranslator["create"]>> | undefined;
    try {
      if (translate) {
        if (sourceLanguage === targetLanguage) throw new Error("Choose two different languages.");
        const api = (window as Window & { Translator?: LocalTranslator }).Translator;
        if (!api) throw new Error("This browser has no on-device Translator API. Try a supported desktop Chromium browser.");
        const pair = { sourceLanguage, targetLanguage };
        if (await api.availability(pair) === "unavailable") throw new Error("This language pair is unavailable on this device.");
        translator = await api.create({ ...pair, monitor: target => {
          target.addEventListener("downloadprogress", event => {
            setStatus("Loading language model… " + Math.round((event as ProgressEvent).loaded * 100) + "%");
          });
        } });
      }
      const pages = await readPdfLines(file, (page, total) => setStatus("Reading page " + page + " of " + total + "…"));
      const texts = pages.map(page => page.map(item => item.text).join(" ").trim());
      if (texts.every(text => !text)) throw new Error("No selectable text found. Run OCR PDF first.");
      if (translator) {
        const output: string[] = [];
        for (const [index, text] of texts.entries()) {
          setStatus("Translating page " + (index + 1) + " of " + texts.length + "…");
          const snippets = text.match(/.{1,1800}(?:\s|$)|.{1,1800}/g) ?? [];
          const parts: string[] = [];
          for (const snippet of snippets) parts.push(await translator.translate(snippet));
          output.push("Page " + (index + 1) + "\n" + parts.join(" ").trim());
        }
        setResult(output.join("\n\n"));
      } else {
        setResult(summarize(texts.join("\n\n"), Number(length)));
      }
      setStatus("");
    } catch (reason) {
      setStatus("");
      setError(reason instanceof Error ? reason.message : "Could not process this PDF.");
    } finally {
      translator?.destroy();
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="PDF tools" backHref="/pdf" title={translate ? "Translate PDF text" : "Summarize PDF"}
      description={translate ? "Translate selectable text into a plain-text file using your browser’s on-device translation model." : "Select key sentences from a PDF using an extractive summary that runs on your device."}>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ToolPanel title="Source PDF">
          {file && <p className="mb-3 break-all rounded-lg border bg-background p-3 text-sm">{file.name}</p>}
          <FilePicker accept=".pdf,application/pdf" action={file ? "Replace PDF" : "Choose PDF"} hint="Or drop a PDF here." disabled={busy} onFiles={files => {
            if (files.length !== 1) { setError("Choose one PDF."); return; }
            setFile(files[0]); setError(""); setResult(""); setStatus("");
          }} />
          <p className="mt-3 text-sm text-muted-foreground">For scanned documents, start with <Link href="/pdf/ocr" className="underline">OCR PDF</Link>.</p>
        </ToolPanel>
        <ToolPanel title={translate ? "Languages" : "Summary options"} description={translate ? "A supported desktop browser may need to download the language model. Document text stays on your device." : "The summary quotes selected sentences from the source."}>
          {translate ? <div className="grid grid-cols-2 gap-3">
            {[
              { label: "From", value: sourceLanguage, setter: setSourceLanguage },
              { label: "To", value: targetLanguage, setter: setTargetLanguage },
            ].map(option => <label key={option.label} className="text-sm font-medium">{option.label}
              <select className="mt-1 block h-9 w-full rounded border bg-background px-2" value={option.value} disabled={busy} onChange={event => option.setter(event.target.value as Language)}>
                {Object.entries(languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>)}
          </div> : <label className="block text-sm font-medium">Maximum sentences
            <select className="mt-1 block h-9 w-full rounded border bg-background px-2" value={length} disabled={busy} onChange={event => setLength(event.target.value)}>
              <option value="3">3</option><option value="5">5</option><option value="10">10</option>
            </select>
          </label>}
          <Button className="mt-4 w-full" disabled={!file || busy} onClick={run}>{translate ? "Translate text" : "Summarize PDF"}</Button>
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          {result && <>
            <Textarea aria-label="Result text" className="mt-4 min-h-48" readOnly value={result} />
            <Button className="mt-3" variant="outline" onClick={() => downloadFile(new Blob([result], { type: "text/plain;charset=utf-8" }), translate ? "translation.txt" : "summary.txt")}>Download text</Button>
          </>}
        </ToolPanel>
      </div>
    </ToolWorkspace>
  );
}