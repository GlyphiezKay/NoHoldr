"use client";

import { ToolWorkspace } from "@/components/layout/tool-workspace";
import { Fragment, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";

interface MatchResult { match: string; index: number; groups: (string | undefined)[]; }

export default function RegexTesterPage() {
    const [pattern, setPattern] = useState("(\\w+)@(\\w+\\.\\w+)");
    const [flags, setFlags] = useState("gi");
    const [testString, setTestString] = useState("Contact us at hello@example.com or support@noholdr.com for help.");
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [capped, setCapped] = useState(false);

    useEffect(() => {
        let worker: Worker | undefined;
        let deadline: ReturnType<typeof setTimeout> | undefined;
        const timer = setTimeout(() => {
            setMatches([]);
            setCapped(false);
            setError(null);
            if (!pattern) return;
            worker = new Worker("/regex-worker.js");
            const finish = (message?: string, result: MatchResult[] = [], capped = false) => {
                worker?.terminate();
                clearTimeout(deadline);
                setMatches(result);
                setCapped(capped);
                setError(message ?? null);
            };
            worker.onmessage = event => finish(event.data.error, event.data.matches, event.data.capped);
            worker.onerror = () => finish("The regex worker could not start.");
            deadline = setTimeout(() => finish("This pattern took too long. Try a simpler pattern or shorter text."), 1500);
            worker.postMessage({ pattern, flags, text: testString });
        }, 150);
        return () => {
            clearTimeout(timer);
            clearTimeout(deadline);
            worker?.terminate();
        };
    }, [pattern, flags, testString]);

    const copyPattern = async () => { await navigator.clipboard.writeText(`/${pattern}/${flags}`); setCopied(true); setTimeout(() => setCopied(false), 1500); };

    const flagOptions = [
        { flag: "g", label: "Global", desc: "Find all matches" },
        { flag: "i", label: "Case Insensitive", desc: "Ignore case" },
        { flag: "m", label: "Multiline", desc: "^ and $ match line starts/ends" },
        { flag: "s", label: "Dot All", desc: ". matches newlines" },
    ];

    const commonPatterns = [
        { label: "Email", pattern: "[\\w.-]+@[\\w.-]+\\.\\w+" },
        { label: "URL", pattern: "https?://[\\w./\\-?=&#]+" },
        { label: "Phone", pattern: "\\+?\\d[\\d-.\\s()]{6,}" },
        { label: "IP Address", pattern: "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}" },
        { label: "Date", pattern: "\\d{4}-\\d{2}-\\d{2}" },
        { label: "Hex Color", pattern: "#[0-9a-fA-F]{3,8}" },
    ];

    return (
        <ToolWorkspace category="Data tools" backHref="/data" title="Regex Tester" description="Test a regular expression and review every match.">
            <div className="utility-body mx-auto w-full max-w-3xl min-w-0 rounded-2xl border bg-card p-4 sm:p-5">

            <div className="border rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-muted-foreground font-mono text-lg">/</span>
                    <Input value={pattern} onChange={(e) => setPattern(e.target.value)} className="font-mono flex-1" aria-label="Pattern" placeholder="pattern" />
                    <span className="text-muted-foreground font-mono text-lg">/</span>
                    <Input value={flags} onChange={(e) => setFlags(e.target.value)} className="font-mono w-16" aria-label="Flags" placeholder="gi" />
                    <Button variant="ghost" size="icon" onClick={copyPattern}>
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {flagOptions.map((f) => (
                        <button key={f.flag} onClick={() => setFlags(flags.includes(f.flag) ? flags.replace(f.flag, "") : flags + f.flag)}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${flags.includes(f.flag) ? "bg-primary/10 border-primary/30 text-primary font-medium" : "text-muted-foreground"}`} title={f.desc}>
                            {f.label}
                        </button>
                    ))}
                </div>
                {error && <p role="alert" className="text-xs text-destructive mt-2">{error}</p>}
            </div>

            <div className="border rounded-xl p-4 mb-4">
                <label className="text-sm font-medium mb-2 block">Test String</label>
                <textarea aria-label="Test string" value={testString} onChange={(e) => setTestString(e.target.value)}
                    className="w-full h-24 p-3 text-sm font-mono bg-muted/30 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Enter text to test..." />
            </div>

            <div className="border rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Result</label>
                    <span className="text-xs text-muted-foreground">{capped ? "First " : ""}{matches.length} match{matches.length !== 1 ? "es" : ""}</span>
                </div>
                <div className="p-3 text-sm font-mono bg-muted/30 rounded-lg whitespace-pre-wrap wrap-anywhere leading-relaxed">
                    {matches.map((match, i) => <Fragment key={i}>
                        {testString.slice(i ? matches[i - 1].index + matches[i - 1].match.length : 0, match.index)}
                        <mark className="rounded bg-yellow-200 px-0.5 text-black dark:bg-yellow-300">{match.match || "▏"}</mark>
                    </Fragment>)}
                    {testString.slice(matches.length ? matches.at(-1)!.index + matches.at(-1)!.match.length : 0)}
                </div>
            </div>

            {matches.length > 0 && (
                <div className="border rounded-xl p-4 mb-4">
                    <h3 className="text-sm font-medium mb-2">Match Details</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {matches.map((m, i) => (
                            <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-lg bg-muted/40 text-sm">
                                <span className="text-xs text-muted-foreground shrink-0 pt-0.5">#{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-mono text-xs break-all">&ldquo;{m.match}&rdquo; <span className="text-muted-foreground">at {m.index}</span></p>
                                    {m.groups.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {m.groups.map((g, j) => <span key={j} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 font-mono">${j + 1}: {g}</span>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="border rounded-xl p-4">
                <h3 className="text-sm font-medium mb-2">Common Patterns</h3>
                <div className="flex flex-wrap gap-1.5">
                    {commonPatterns.map((cp) => (
                        <button key={cp.label} onClick={() => setPattern(cp.pattern)} className="px-2.5 py-1.5 text-xs rounded-md border hover:bg-muted/50 transition-colors">{cp.label}</button>
                    ))}
                </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-6">JavaScript regex engine • Tested locally</p>
            </div>
        </ToolWorkspace>
    );
}
