"use client";

import { ToolWorkspace } from "@/components/layout/tool-workspace";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

type DiffPart = { type: "same" | "add" | "remove"; text: string };

// Word-level diff using Longest Common Subsequence (LCS)
function diffWords(original: string, modified: string): DiffPart[] {
    const words1 = original.split(/(\s+)/); // Keep whitespace
    const words2 = modified.split(/(\s+)/);

    // Build LCS table
    const m = words1.length;
    const n = words2.length;
    if ((m + 1) * (n + 1) > 4_000_000) throw new Error("These texts are too large to compare together. Compare smaller sections.");
    const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (words1[i - 1] === words2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack to find diff
    const result: DiffPart[] = [];
    let i = m, j = n;
    const stack: DiffPart[] = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && words1[i - 1] === words2[j - 1]) {
            stack.push({ type: "same", text: words1[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            stack.push({ type: "add", text: words2[j - 1] });
            j--;
        } else if (i > 0) {
            stack.push({ type: "remove", text: words1[i - 1] });
            i--;
        }
    }

    // Reverse stack and merge consecutive same-type parts
    while (stack.length > 0) {
        const part = stack.pop()!;
        if (result.length > 0 && result[result.length - 1].type === part.type) {
            result[result.length - 1].text += part.text;
        } else {
            result.push(part);
        }
    }

    return result;
}

export default function TextDiffPage() {
    const [text1, setText1] = useState("");
    const [text2, setText2] = useState("");
    const [diff, setDiff] = useState<DiffPart[]>([]);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    const compare = () => {
        setError("");
        try { setDiff(diffWords(text1, text2)); }
        catch (reason) { setDiff([]); setError(reason instanceof Error ? reason.message : "Could not compare the texts."); }
    };

    const copyDiff = async () => {
        // Create plain text representation
        let text = "";
        for (const part of diff) {
            if (part.type === "same") text += part.text;
            else if (part.type === "remove") text += `[-${part.text}-]`;
            else if (part.type === "add") text += `[+${part.text}+]`;
        }
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const stats = {
        removed: diff.filter(d => d.type === "remove").reduce((acc, d) => acc + d.text.trim().split(/\s+/).filter(Boolean).length, 0),
        added: diff.filter(d => d.type === "add").reduce((acc, d) => acc + d.text.trim().split(/\s+/).filter(Boolean).length, 0),
    };

    return (
        <ToolWorkspace category="Data tools" backHref="/data" title="Text Diff" description="Compare two texts and inspect additions and removals.">
            <div className="utility-body mx-auto w-full max-w-4xl min-w-0 rounded-2xl border bg-card p-4 sm:p-5">

            {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-sm font-medium mb-2 block">Original Text</label>
                    <textarea
                        value={text1}
                        onChange={(e) => setText1(e.target.value)}
                        placeholder="Enter original text..."
                        className="w-full h-48 p-3 rounded-xl border bg-muted/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium mb-2 block">Modified Text</label>
                    <textarea
                        value={text2}
                        onChange={(e) => setText2(e.target.value)}
                        placeholder="Enter modified text..."
                        className="w-full h-48 p-3 rounded-xl border bg-muted/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
            </div>

            <Button onClick={compare} disabled={!text1 && !text2} className="mb-4">
                Compare
            </Button>

            {diff.length > 0 && (
                <div className="space-y-4">
                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-red-600 dark:text-red-400">
                            −{stats.removed} removed
                        </span>
                        <span className="text-green-600 dark:text-green-400">
                            +{stats.added} added
                        </span>
                        <Button variant="ghost" size="sm" onClick={copyDiff} className="ml-auto">
                            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                            Copy
                        </Button>
                    </div>

                    {/* Inline Diff Output */}
                    <div className="border rounded-xl p-4 bg-muted/20">
                        <p className="text-sm font-medium mb-2 text-muted-foreground">Inline Diff</p>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            {diff.map((part, i) => {
                                if (part.type === "same") {
                                    return <span key={i}>{part.text}</span>;
                                } else if (part.type === "remove") {
                                    return (
                                        <span
                                            key={i}
                                            className="bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 line-through decoration-red-500"
                                        >
                                            {part.text}
                                        </span>
                                    );
                                } else {
                                    return (
                                        <span
                                            key={i}
                                            className="bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300"
                                        >
                                            {part.text}
                                        </span>
                                    );
                                }
                            })}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-red-100 dark:bg-red-950/50 border border-red-300"></span>
                            Removed
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-green-100 dark:bg-green-950/50 border border-green-300"></span>
                            Added
                        </span>
                    </div>
                </div>
            )}

            <p className="text-xs text-muted-foreground text-center mt-6">
                Word-level comparison • Processed locally
            </p>
            </div>
        </ToolWorkspace>
    );
}
