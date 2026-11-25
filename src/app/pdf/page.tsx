"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown, Camera, Columns2, Crop, Eye, FileImage, FileText, GraduationCap, Hash, Images, Languages, Lock, Merge,
  Minimize2, Pen, Presentation, RotateCw, ScanText, Search, Shield, Split, Stamp, Table2, Trash2, Unlock, Wrench, Workflow, SquarePen,
} from "lucide-react";
import { ToolWorkspace } from "@/components/layout/tool-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const groups = [
  {
    title: "Organize pages",
    tools: [
      { name: "Merge PDFs", path: "merge", icon: Merge, description: "Combine files in the order you choose." },
      { name: "Split PDF", path: "split", icon: Split, description: "Extract a page range from a PDF." },
      { name: "Extract Pages", path: "extract", icon: FileText, description: "Select specific pages and arrange them in one new PDF." },
      { name: "Academic Split", path: "academic-split", icon: GraduationCap, description: "Export named sections as separate PDFs." },
      { name: "Remove Pages", path: "remove-pages", icon: Trash2, description: "Delete selected pages from a copy." },
      { name: "Reorder Pages", path: "reorder", icon: ArrowUpDown, description: "Rearrange pages before exporting." },
      { name: "Rotate Pages", path: "rotate", icon: RotateCw, description: "Change page orientation." },
      { name: "Scan to PDF", path: "scan", icon: Camera, description: "Use document photos or scans to make a PDF." },
    ],
  },
  {
    title: "Optimize and recover",
    tools: [
      { name: "OCR PDF", path: "ocr", icon: ScanText, description: "Make English or Indonesian scans searchable on your device." },
      { name: "Repair PDF", path: "repair", icon: Wrench, description: "Rebuild and check recoverable PDF structure." },
    ],
  },
  {
    title: "Convert to PDF",
    tools: [
      { name: "Images to PDF", path: "from-images", icon: Images, description: "Combine images and set page size and margins." },
      { name: "Word to PDF", path: "word-to-pdf", icon: FileText, description: "Render DOCX, DOC, ODT, and RTF on desktop Chromium." },
      { name: "Excel to PDF", path: "excel-to-pdf", icon: Table2, description: "Render an Excel workbook with its page settings." },
      { name: "PowerPoint to PDF", path: "powerpoint-to-pdf", icon: Presentation, description: "Convert presentation slides to PDF." },
      { name: "HTML to PDF", path: "html-to-pdf", icon: FileText, description: "Render a local HTML file." },
    ],
  },
  {
    title: "Export from PDF",
    tools: [
      { name: "PDF to Images", path: "to-images", icon: FileImage, description: "Export pages to JPEG, PNG, or WebP." },
      { name: "PDF to Word", path: "to-word", icon: FileText, description: "Export selectable text into an editable DOCX." },
      { name: "PDF to Excel", path: "to-excel", icon: Table2, description: "Extract selectable text into worksheet cells." },
      { name: "PDF to PowerPoint", path: "to-powerpoint", icon: Presentation, description: "Make one slide image for each page, preserving its appearance." },
      { name: "PDF to PDF/A", path: "pdfa", icon: Shield, description: "Create a flattened PDF/A-2b archival copy." },
      { name: "PDF to Markdown", path: "to-markdown", icon: FileText, description: "Export text and detected headings." },
    ],
  },
  {
    title: "Edit and inspect",
    tools: [
      { name: "Edit PDF", path: "edit", icon: SquarePen, description: "Add text, images, and rectangles to a page." },
      { name: "Crop PDF", path: "crop", icon: Crop, description: "Adjust the visible bounds of selected pages." },
      { name: "PDF Forms", path: "forms", icon: SquarePen, description: "Fill or create interactive AcroForm fields." },
      { name: "Watermark", path: "watermark", icon: Stamp, description: "Apply a watermark to the document." },
      { name: "Page Numbers", path: "page-numbers", icon: Hash, description: "Add page numbers to your document." },
      { name: "View Metadata", path: "metadata", icon: Eye, description: "Inspect the title, author, and other properties." },
      { name: "Compare PDFs", path: "compare", icon: Columns2, description: "Review two versions side by side." },
    ],
  },
  {
    title: "Protect and sign",
    tools: [
      { name: "Protect PDF", path: "protect", icon: Lock, description: "Encrypt a PDF with an AES-256 password." },
      { name: "Unlock PDF", path: "unlock", icon: Unlock, description: "Decrypt a PDF using its current password." },
      { name: "Sign PDF", path: "sign", icon: Pen, description: "Place a drawn or typed signature on a page." },
      { name: "Redact PDF", path: "redact", icon: Shield, description: "Remove sensitive areas from a flattened copy." },
    ],
  },
  {
    title: "Read and automate",
    tools: [
      { name: "Summarize PDF", path: "summarize", icon: FileText, description: "Extract key sentences locally." },
      { name: "Translate PDF text", path: "translate", icon: Languages, description: "Translate text using a supported browser’s on-device model." },
      { name: "PDF Workflow", path: "workflow", icon: Workflow, description: "Extract, compress, and protect in one pass." },
    ],
  },
];

const compressor = {
  name: "Compress PDF",
  path: "compress",
  icon: Minimize2,
  description: "Reduce file size with selectable text or stronger compression for scanned PDFs.",
};

type PdfTool = typeof compressor;

function PdfToolCard({ tool }: { tool: PdfTool }) {
  return (
    <li>
      <Link href={"/pdf/" + tool.path} className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-ring hover:bg-accent focus-visible:outline-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary"><tool.icon className="size-5" aria-hidden="true" /></span>
        <div>
          <h3 className="font-semibold">{tool.name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
        </div>
      </Link>
    </li>
  );
}

export default function PDFToolsPage() {
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (tool: PdfTool) => words.every(word => (tool.name + " " + tool.description).toLowerCase().includes(word));
  const filtered = groups.map(group => ({ ...group, tools: group.tools.filter(matches) })).filter(group => group.tools.length);
  const showCompress = matches(compressor);
  const resultCount = filtered.reduce((total, group) => total + group.tools.length, showCompress ? 1 : 0);

  return (
    <ToolWorkspace category="All tools" backHref="/" title="PDF tools" description="Compress, organize, convert, and edit PDF files in your browser.">
      <div className="relative mb-6 max-w-lg">
        <Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
        <Input type="search" aria-label="Find a PDF tool" placeholder="Find a PDF tool" className="h-10 bg-card pl-9"
          value={query} onChange={event => setQuery(event.target.value)} />
      </div>

      {words.length > 0 && <p role="status" className="mb-4 text-sm text-muted-foreground">{resultCount} {resultCount === 1 ? "tool" : "tools"} found</p>}
      {showCompress && (
        <section className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-accent p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#d8fb46] text-[#17200d]"><Minimize2 className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 className="text-lg font-semibold">{compressor.name}</h2>
              <p className="text-sm text-muted-foreground">{compressor.description}</p>
            </div>
          </div>
          <Button asChild><Link href="/pdf/compress">Open compressor</Link></Button>
        </section>
      )}
      {!resultCount && <Button variant="outline" onClick={() => setQuery("")}>Clear search</Button>}
      <div className="space-y-8">
        {filtered.map(group => (
          <section key={group.title}>
            <h2 className="mb-3 text-xl font-semibold tracking-tight">{group.title}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map(tool => <PdfToolCard key={tool.path} tool={tool} />)}
            </ul>
          </section>
        ))}
      </div>
    </ToolWorkspace>
  );
}
