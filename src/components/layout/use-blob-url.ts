"use client";

import { useEffect, useState } from "react";

export function useBlobUrl(blob: Blob | null | undefined) {
  const [preview, setPreview] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    let active = true;
    queueMicrotask(() => { if (active) setPreview({ blob, url }); });
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [blob]);
  return preview?.blob === blob ? preview?.url : undefined;
}
