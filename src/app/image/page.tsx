"use client";

import { Images } from "lucide-react";
import { ToolDirectory } from "@/components/layout/tool-directory";
import { imageGroups } from "@/lib/tool-directory";

export default function ToolsPage() {
  return (
    <ToolDirectory
      tone="image"
      title="Image tools"
      description="Compress, resize, and edit one image or a whole batch on your device."
      icon={Images}
      groups={imageGroups}
      shortcuts={["/image/compress", "/image/resize", "/image/convert"]}
    />
  );
}
