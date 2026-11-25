"use client";

import { ToolWorkspace } from "@/components/layout/tool-workspace";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
    <div className="p-3 rounded-lg bg-muted/40 text-center">
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
    </div>
);

export default function WordCounterPage() {
    const [text, setText] = useState("");
    const [copied, setCopied] = useState(false);

    const stats = useMemo(() => {
        if (!text) return { chars: 0, charsNoSpaces: 0, words: 0, sentences: 0, paragraphs: 0, lines: 0, readingTime: "0 sec", speakingTime: "0 sec", uniqueWords: 0, avgWordLen: 0, longestWord: "" };
        const words = text.split(/\s+/).filter(Boolean);
        const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
        const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
        const lines = text.split("\n");
        const wordSet = new Set(words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean));
        const avgLen = words.length > 0 ? words.reduce((a, w) => a + w.length, 0) / words.length : 0;
        const longest = words.reduce((a, w) => (w.length > a.length ? w : a), "");
        const readMins = words.length / 200;
        const speakMins = words.length / 130;
        const fmt = (mins: number) => mins < 1 ? `${Math.ceil(mins * 60)} sec` : `${Math.floor(mins)} min ${Math.round((mins % 1) * 60)} sec`;

        return {
            chars: text.length,
            charsNoSpaces: text.replace(/\s/g, "").length,
            words: words.length,
            sentences: sentences.length,
            paragraphs: paragraphs.length,
            lines: lines.length,
            readingTime: fmt(readMins),
            speakingTime: fmt(speakMins),
            uniqueWords: wordSet.size,
            avgWordLen: Math.round(avgLen * 10) / 10,
            longestWord: longest,
        };
    }, [text]);

    // Top words frequency
    const topWords = useMemo(() => {
        if (!text) return [];
        const freq = new Map<string, number>();
        text.split(/\s+/).filter(Boolean).forEach((w) => {
            const key = w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
            if (key.length > 1) freq.set(key, (freq.get(key) ?? 0) + 1);
        });
        return [...freq].sort((a, b) => b[1] - a[1]).slice(0, 10);
    }, [text]);

    const copyStats = async () => {
        const s = `Characters: ${stats.chars}\nWords: ${stats.words}\nSentences: ${stats.sentences}\nParagraphs: ${stats.paragraphs}\nReading time: ${stats.readingTime}`;
        await navigator.clipboard.writeText(s);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <ToolWorkspace category="Data tools" backHref="/data" title="Word Counter" description="Measure words, characters, lines, and reading time.">
            <div className="utility-body mx-auto w-full max-w-3xl min-w-0 rounded-2xl border bg-card p-4 sm:p-5">

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-48 p-4 text-sm bg-background border rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 mb-4"
                placeholder="Paste or type your text here..."
            />

            {/* Stats grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                <StatCard label="Characters" value={stats.chars} />
                <StatCard label="No Spaces" value={stats.charsNoSpaces} />
                <StatCard label="Words" value={stats.words} />
                <StatCard label="Sentences" value={stats.sentences} />
                <StatCard label="Paragraphs" value={stats.paragraphs} />
                <StatCard label="Lines" value={stats.lines} />
            </div>

            {/* Extra stats */}
            <div className="border rounded-xl p-4 mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-xs text-muted-foreground">Reading time</span><p className="font-medium">{stats.readingTime}</p></div>
                    <div><span className="text-xs text-muted-foreground">Speaking time</span><p className="font-medium">{stats.speakingTime}</p></div>
                    <div><span className="text-xs text-muted-foreground">Unique words</span><p className="font-medium">{stats.uniqueWords}</p></div>
                    <div><span className="text-xs text-muted-foreground">Avg word length</span><p className="font-medium">{stats.avgWordLen} chars</p></div>
                </div>
            </div>

            {/* Top words */}
            {topWords.length > 0 && (
                <div className="border rounded-xl p-4 mb-4">
                    <h3 className="text-sm font-medium mb-2">Top Words</h3>
                    <div className="flex flex-wrap gap-1.5">
                        {topWords.map(([word, count]) => (
                            <span key={word} className="px-2 py-1 text-xs rounded-md bg-muted/60 font-mono">
                                {word} <span className="text-muted-foreground">×{count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <Button variant="outline" className="w-full" onClick={copyStats} disabled={!text}>
                {copied ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied Stats" : "Copy Stats"}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-6">Words at 200 wpm reading • 130 wpm speaking</p>
            </div>
        </ToolWorkspace>
    );
}
