"use client";

import { Binary, Braces, Clock, Code, Database, Eye, FileJson, FileSpreadsheet, FileText, Hash, KeyRound, LetterText, Palette, Pipette, QrCode, Ruler, ScrollText } from "lucide-react";
import { UtilityDirectory } from "@/components/layout/utility-directory";
import type { DirectoryGroup } from "@/lib/tool-directory";

const groups: DirectoryGroup[] = [
  { title: "Format and encode", icon: Braces, tone: "teal", tools: [
    { name: "JSON Format", href: "/data/json", icon: FileJson, description: "Validate, format, and minify JSON." },
    { name: "CSV Viewer", href: "/data/csv", icon: FileSpreadsheet, description: "Open a CSV, inspect rows, and export as JSON." },
    { name: "Base64", href: "/data/base64", icon: Binary, description: "Encode or decode UTF-8 text and binary files." },
    { name: "URL Encode", href: "/data/url-encode", icon: Code, description: "Encode and decode URL components." },
    { name: "Text Hash", href: "/data/hash", icon: Hash, description: "Calculate and verify a digest for text or files." },
  ] },
  { title: "Write and inspect", icon: FileText, tone: "blue", tools: [
    { name: "Text Diff", href: "/data/diff", icon: FileText, description: "Compare two versions and inspect added or removed text." },
    { name: "Markdown Preview", href: "/data/markdown", icon: Eye, description: "Review formatted Markdown beside the source." },
    { name: "Regex Tester", href: "/data/regex", icon: Braces, description: "Test patterns, flags, and match groups." },
    { name: "Word Counter", href: "/data/word-counter", icon: LetterText, description: "Count words, characters, and lines." },
    { name: "Lorem Ipsum", href: "/data/lorem-ipsum", icon: ScrollText, description: "Generate placeholder text by word, sentence, or paragraph." },
  ] },
  { title: "Generate and convert", icon: QrCode, tone: "purple", tools: [
    { name: "QR Code", href: "/data/qr-code", icon: QrCode, description: "Create and download a QR code." },
    { name: "Color Picker", href: "/data/color-picker", icon: Palette, description: "Pick a color and copy its HEX, RGB, or HSL value." },
    { name: "Color Extractor", href: "/data/color-extractor", icon: Pipette, description: "Build a palette from the colors in an image." },
    { name: "Password Generator", href: "/data/password", icon: KeyRound, description: "Generate passwords, passphrases, and PINs locally." },
    { name: "Timestamp Converter", href: "/data/timestamp", icon: Clock, description: "Convert Unix timestamps and calendar times." },
    { name: "Unit Converter", href: "/data/unit-converter", icon: Ruler, description: "Convert length, mass, temperature, and more." },
  ] },
];

export default function DataToolsPage() {
  return <UtilityDirectory tone="data" title="Data tools" description="Format files, inspect text, and generate everyday utilities in your browser." icon={Database} groups={groups} />;
}
