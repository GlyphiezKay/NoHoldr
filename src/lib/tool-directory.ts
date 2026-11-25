import {
  Aperture, ArrowUpDown, Blend, Camera, Columns2, Crop, Eye, FileImage, FileText, Film, Focus, GraduationCap, Hash,
  Images, Languages, Lock, Maximize2, Merge, Minimize2, Palette, Pen, Presentation, RotateCw, ScanText, Shield, Split,
  SquarePen, Stamp, Table2, Trash2, Type, Unlock, Workflow, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DirectoryTool = { name: string; href: string; icon: LucideIcon; description: string };
export type DirectoryGroup = {
  title: string;
  icon: LucideIcon;
  tone: "rose" | "green" | "blue" | "sky" | "purple" | "amber" | "teal";
  tools: DirectoryTool[];
};

export const pdfCompressor = {
  name: "Compress PDF",
  href: "/pdf/compress",
  icon: Minimize2,
  description: "Reduce file size with selectable text or stronger compression for scanned PDFs.",
};

export const pdfGroups: DirectoryGroup[] = [
  {
    title: "Organize pages", icon: ArrowUpDown, tone: "rose",
    tools: [
      { name: "Merge PDFs", href: "/pdf/merge", icon: Merge, description: "Combine files in the order you choose." },
      { name: "Split PDF", href: "/pdf/split", icon: Split, description: "Extract a page range from a PDF." },
      { name: "Extract Pages", href: "/pdf/extract", icon: FileText, description: "Select specific pages and arrange them in one new PDF." },
      { name: "Academic Split", href: "/pdf/academic-split", icon: GraduationCap, description: "Export named sections as separate PDFs." },
      { name: "Remove Pages", href: "/pdf/remove-pages", icon: Trash2, description: "Delete selected pages from a copy." },
      { name: "Reorder Pages", href: "/pdf/reorder", icon: ArrowUpDown, description: "Rearrange pages before exporting." },
      { name: "Rotate Pages", href: "/pdf/rotate", icon: RotateCw, description: "Change page orientation." },
      { name: "Scan to PDF", href: "/pdf/scan", icon: Camera, description: "Use document photos or scans to make a PDF." },
    ],
  },
  {
    title: "Optimize and recover", icon: Minimize2, tone: "green",
    tools: [
      pdfCompressor,
      { name: "OCR PDF", href: "/pdf/ocr", icon: ScanText, description: "Make English or Indonesian scans searchable on your device." },
      { name: "Repair PDF", href: "/pdf/repair", icon: Wrench, description: "Rebuild and check recoverable PDF structure." },
    ],
  },
  {
    title: "Convert to PDF", icon: FileText, tone: "blue",
    tools: [
      { name: "Images to PDF", href: "/pdf/from-images", icon: Images, description: "Combine images and set page size and margins." },
      { name: "Word to PDF", href: "/pdf/word-to-pdf", icon: FileText, description: "Render DOCX, DOC, ODT, and RTF on desktop Chromium." },
      { name: "Excel to PDF", href: "/pdf/excel-to-pdf", icon: Table2, description: "Render an Excel workbook with its page settings." },
      { name: "PowerPoint to PDF", href: "/pdf/powerpoint-to-pdf", icon: Presentation, description: "Convert presentation slides to PDF." },
      { name: "HTML to PDF", href: "/pdf/html-to-pdf", icon: FileText, description: "Render a local HTML file." },
    ],
  },
  {
    title: "Export from PDF", icon: FileImage, tone: "sky",
    tools: [
      { name: "PDF to Images", href: "/pdf/to-images", icon: FileImage, description: "Export pages to JPEG, PNG, or WebP." },
      { name: "PDF to Word", href: "/pdf/to-word", icon: FileText, description: "Export selectable text into an editable DOCX." },
      { name: "PDF to Excel", href: "/pdf/to-excel", icon: Table2, description: "Extract selectable text into worksheet cells." },
      { name: "PDF to PowerPoint", href: "/pdf/to-powerpoint", icon: Presentation, description: "Make one slide image for each page, preserving its appearance." },
      { name: "PDF to PDF/A", href: "/pdf/pdfa", icon: Shield, description: "Create a flattened PDF/A-2b archival copy." },
      { name: "PDF to Markdown", href: "/pdf/to-markdown", icon: FileText, description: "Export text and detected headings." },
    ],
  },
  {
    title: "Edit and inspect", icon: SquarePen, tone: "purple",
    tools: [
      { name: "Edit PDF", href: "/pdf/edit", icon: SquarePen, description: "Add text, images, and rectangles to a page." },
      { name: "Crop PDF", href: "/pdf/crop", icon: Crop, description: "Adjust the visible bounds of selected pages." },
      { name: "PDF Forms", href: "/pdf/forms", icon: SquarePen, description: "Fill or create interactive AcroForm fields." },
      { name: "Watermark", href: "/pdf/watermark", icon: Stamp, description: "Apply a watermark to the document." },
      { name: "Page Numbers", href: "/pdf/page-numbers", icon: Hash, description: "Add page numbers to your document." },
      { name: "View Metadata", href: "/pdf/metadata", icon: Eye, description: "Inspect the title, author, and other properties." },
      { name: "Compare PDFs", href: "/pdf/compare", icon: Columns2, description: "Review two versions side by side." },
    ],
  },
  {
    title: "Protect and sign", icon: Shield, tone: "amber",
    tools: [
      { name: "Protect PDF", href: "/pdf/protect", icon: Lock, description: "Encrypt a PDF with an AES-256 password." },
      { name: "Unlock PDF", href: "/pdf/unlock", icon: Unlock, description: "Decrypt a PDF using its current password." },
      { name: "Sign PDF", href: "/pdf/sign", icon: Pen, description: "Place a drawn or typed signature on a page." },
      { name: "Redact PDF", href: "/pdf/redact", icon: Shield, description: "Remove sensitive areas from a flattened copy." },
    ],
  },
  {
    title: "Read and automate", icon: Workflow, tone: "teal",
    tools: [
      { name: "Summarize PDF", href: "/pdf/summarize", icon: FileText, description: "Extract key sentences locally." },
      { name: "Translate PDF text", href: "/pdf/translate", icon: Languages, description: "Translate text using a supported browser’s on-device model." },
      { name: "PDF Workflow", href: "/pdf/workflow", icon: Workflow, description: "Extract, compress, and protect in one pass." },
    ],
  },
];

export const imageGroups: DirectoryGroup[] = [
  { title: "Size and dimensions", icon: Maximize2, tone: "purple", tools: [
    { name: "Compress Images", href: "/image/compress", icon: Minimize2, description: "Batch compress by quality or target KB per image." },
    { name: "Resize Images", href: "/image/resize", icon: Maximize2, description: "Set exact sizes, fit within a box, or use a percentage." },
    { name: "Upscale Images", href: "/image/upscale", icon: Focus, description: "Enlarge images up to 4× with high-quality resampling." },
  ] },
  { title: "Edit and create", icon: SquarePen, tone: "rose", tools: [
    { name: "Crop Images", href: "/image/crop", icon: Crop, description: "Select a crop by hand or apply a batch crop." },
    { name: "Rotate and Flip", href: "/image/rotate", icon: RotateCw, description: "Rotate or mirror multiple images in one batch." },
    { name: "Photo Editor", href: "/image/edit", icon: SquarePen, description: "Adjust colors and exposure or place a caption." },
    { name: "Watermark Images", href: "/image/watermark", icon: Stamp, description: "Add a text watermark or logo." },
    { name: "Meme Generator", href: "/image/meme", icon: Type, description: "Add customizable top and bottom text." },
    { name: "Make Animated GIF", href: "/image/gif", icon: Film, description: "Turn ordered images into a looping animation." },
    { name: "Extract Colors", href: "/data/color-extractor", icon: Palette, description: "Inspect the colors in an image." },
  ] },
  { title: "Convert and export", icon: FileImage, tone: "blue", tools: [
    { name: "Convert Images", href: "/image/convert", icon: FileImage, description: "Convert a batch to JPEG, WebP, PNG, BMP, GIF, ICO, or other available formats." },
    { name: "Images to PDF", href: "/pdf/from-images", icon: FileText, description: "Combine images into a PDF, one image per page." },
    { name: "HTML to Image", href: "/image/html", icon: FileImage, description: "Render local HTML into a PNG or JPEG." },
  ] },
  { title: "Privacy and cleanup", icon: Aperture, tone: "green", tools: [
    { name: "Hide Image Areas", href: "/image/blur", icon: Aperture, description: "Pixelate or cover selected regions such as faces and license plates." },
    { name: "Remove Color Background", href: "/image/remove-background", icon: Blend, description: "Remove a selected background color and export transparency." },
    { name: "View Image Metadata", href: "/image/metadata", icon: Eye, description: "Inspect available EXIF, GPS, XMP, and IPTC tags." },
    { name: "Remove Image Metadata", href: "/image/remove-metadata", icon: Trash2, description: "Re-encode image pixels to remove source metadata in a batch." },
  ] },
];

export function matchesTool(tool: DirectoryTool, query: string) {
  const text = `${tool.name} ${tool.description} ${tool.href.replaceAll("-", " ")}`.toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).every(word => text.includes(word));
}
