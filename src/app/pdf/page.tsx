"use client";

import { FileText } from "lucide-react";
import { ToolDirectory } from "@/components/layout/tool-directory";
import { pdfGroups } from "@/lib/tool-directory";

export default function ToolsPage() {
  return (
    <ToolDirectory
      tone="pdf"
      title="PDF tools"
      description="Compress, organize, convert, and edit PDF files in your browser."
      icon={FileText}
      groups={pdfGroups}
      shortcuts={["/pdf/compress", "/pdf/merge", "/pdf/word-to-pdf"]}
    />
  );
}
