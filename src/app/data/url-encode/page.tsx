"use client";

import { ToolWorkspace } from "@/components/layout/tool-workspace";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export default function URLEncodePage() {
    const [input, setInput] = useState("");
    const [output, setOutput] = useState("");
    const [copied, setCopied] = useState(false);

    const encode = () => setOutput(encodeURIComponent(input));
    const decode = () => {
        try { setOutput(decodeURIComponent(input)); }
        catch { setOutput("Error decoding"); }
    };

    const copy = async () => {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <ToolWorkspace category="Data tools" backHref="/data" title="URL Encode/Decode" description="Encode or decode URL components.">
            <div className="utility-body mx-auto w-full max-w-2xl min-w-0 rounded-2xl border bg-card p-4 sm:p-5">

            <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Input</label>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter text or URL encoded string..."
                    className="w-full h-32 p-3 rounded-xl border bg-muted/30 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>

            <div className="flex gap-2 mb-4">
                <Button onClick={encode}>Encode</Button>
                <Button variant="outline" onClick={decode}>Decode</Button>
            </div>

            {output && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Output</label>
                        <Button variant="ghost" size="sm" onClick={copy} className="h-7">
                            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                            {copied ? "Copied" : "Copy"}
                        </Button>
                    </div>
                    <div className="p-3 rounded-xl border bg-muted/30 font-mono text-sm break-all">{output}</div>
                </div>
            )}

            <p className="text-xs text-muted-foreground text-center mt-6">Processed locally</p>
            </div>
        </ToolWorkspace>
    );
}
