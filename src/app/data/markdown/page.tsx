"use client";

import { ToolWorkspace } from "@/components/layout/tool-workspace";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export default function MarkdownPreviewPage() {
    const [markdown, setMarkdown] = useState(`# Hello World

Welcome to the **Markdown Preview** tool.

## Features
- Real-time preview
- Supports **bold**, *italic*, ~~strikethrough~~
- Code blocks, lists, links, and more

### Code Example
\`\`\`javascript
function greet(name) {
    return \`Hello, \${name}!\`;
}
\`\`\`

> This is a blockquote.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1    | Data     | Value    |
| Row 2    | Data     | Value    |

[Visit NoHoldr](https://noholdr.com)

---

1. First item
2. Second item
3. Third item
`);
    const [copied, setCopied] = useState(false);
    const [view, setView] = useState<"split" | "edit" | "preview">("split");

    const copy = async () => {
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const previewStyles = `
        .markdown-preview h1 { font-size: 1.75em; font-weight: 700; margin: 0.5em 0 0.3em; border-bottom: 1px solid var(--border-color, #e5e7eb); padding-bottom: 0.2em; }
        .markdown-preview h2 { font-size: 1.4em; font-weight: 600; margin: 0.5em 0 0.3em; border-bottom: 1px solid var(--border-color, #e5e7eb); padding-bottom: 0.2em; }
        .markdown-preview h3 { font-size: 1.15em; font-weight: 600; margin: 0.5em 0 0.3em; }
        .md-h4, .md-h5, .markdown-preview h6 { font-size: 1em; font-weight: 600; margin: 0.5em 0 0.3em; }
        .markdown-preview p { margin: 0.6em 0; line-height: 1.7; }
        .markdown-preview pre { background: #1e1e2e; color: #cdd6f4; padding: 12px 16px; border-radius: 8px; overflow-x: auto; margin: 0.8em 0; font-size: 0.85em; }
        .markdown-preview code { font-family: 'Fira Code', 'Consolas', monospace; }
        .md-inline-code { background: rgba(100,100,100,0.15); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: 'Fira Code', 'Consolas', monospace; }
        .markdown-preview blockquote { border-left: 3px solid #6366f1; padding: 8px 16px; margin: 0.8em 0; color: #666; background: rgba(99,102,241,0.05); border-radius: 0 6px 6px 0; }
        .md-ul, .markdown-preview ol { padding-left: 1.5em; margin: 0.6em 0; }
        .md-li, .md-oli { margin: 0.2em 0; }
        .markdown-preview a { color: #6366f1; text-decoration: underline; }
        .markdown-preview hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.2em 0; }
        .markdown-preview table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
        .markdown-preview th { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; font-weight: 600; background: rgba(0,0,0,0.03); }
        .markdown-preview td { border: 1px solid #e5e7eb; padding: 8px 12px; }
        .md-img { max-width: 100%; border-radius: 8px; margin: 0.5em 0; }
    `;

    const lines = markdown.split("\n").length;
    const words = markdown.split(/\s+/).filter(Boolean).length;

    return (
        <ToolWorkspace category="Data tools" backHref="/data" title="Markdown Preview" description="Edit Markdown and see the formatted result alongside it.">
            <div className="utility-body mx-auto w-full max-w-5xl min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
            <div className="mb-4 flex justify-end">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{words} words • {lines} lines</span>
                    <Button variant="ghost" size="sm" onClick={copy}>
                        {copied ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copied ? "Copied" : "Copy"}
                    </Button>
                </div>
            </div>

            {/* View toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg mb-4">
                {(["split", "edit", "preview"] as const).map((v) => (
                    <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors capitalize ${view === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                    >
                        {v === "split" ? "Split" : v === "edit" ? "Edit" : "Preview"}
                    </button>
                ))}
            </div>

            {/* Editor + Preview */}
            <div className={`gap-4 ${view === "split" ? "grid md:grid-cols-2" : ""}`}>
                {(view === "split" || view === "edit") && (
                    <div className="border rounded-xl overflow-hidden">
                        <textarea
                            value={markdown}
                            onChange={(e) => setMarkdown(e.target.value)}
                            className="w-full h-[65vh] p-4 text-sm font-mono bg-background resize-none focus:outline-none"
                            aria-label="Markdown source" placeholder="Type your markdown here..."
                            spellCheck={false}
                        />
                    </div>
                )}

                {(view === "split" || view === "preview") && (
                    <div className="border rounded-xl overflow-hidden">
                        <style>{previewStyles}</style>
                        <div className="markdown-preview min-h-56 max-h-[65vh] overflow-auto wrap-anywhere p-4 text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
                                a: ({ href, children }) => href && /^https?:\/\//i.test(href)
                                    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
                                img: ({ alt }) => <span className="text-muted-foreground">{alt ? "Image: " + alt : "Image"}</span>,
                            }}>{markdown}</ReactMarkdown>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-6">Rendered locally • No data sent anywhere</p>
            </div>
        </ToolWorkspace>
    );
}
