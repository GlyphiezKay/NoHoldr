"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, File, FileText, Film, Image as ImageIcon } from "lucide-react";
import { formatBytes } from "@/lib/download-manager";
import { useThumbnails } from "./thumbnail-preference";

function fileKind(blob: Blob, name: string) {
  if (blob.type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (blob.type.startsWith("image/") || /\.(avif|bmp|gif|heic|heif|ico|jpe?g|png|tiff?|webp)$/i.test(name)) return "image";
  if (blob.type.startsWith("video/") || /\.(mp4|m4v|mov|mkv|webm)$/i.test(name)) return "video";
  if (blob.type.startsWith("audio/") || /\.(aac|flac|m4a|mp3|ogg|wav)$/i.test(name)) return "audio";
  return "file";
}

const icons = { pdf: FileText, image: ImageIcon, video: Film, audio: AudioLines, file: File };

export function FileThumbnail({ blob, name }: { blob: Blob; name: string }) {
  const enabled = useThumbnails();
  const kind = fileKind(blob, name);
  const Icon = icons[kind];
  return (
    <span className="studio-thumbnail" data-file-thumbnail={kind} aria-hidden="true">
      <Icon size={22} />
      {enabled && (kind === "pdf" || kind === "image" || kind === "video") &&
        <FileThumbnailImage key={name} blob={blob} kind={kind} />}
    </span>
  );
}

function FileThumbnailImage({ blob, kind }: { blob: Blob; kind: "pdf" | "image" | "video" }) {
  const root = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<{ blob: Blob; url: string }>();

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setReady(true);
        observer.disconnect();
      }
    }, { rootMargin: "100px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || (kind === "pdf" && blob.size > 64 * 1024 * 1024)) return;
    let cancelled = false;
    let url: string | undefined;
    let destroy: (() => Promise<void>) | undefined;

    function show(source: Blob) {
      if (cancelled) return;
      url = URL.createObjectURL(source);
      setPreview({ blob, url });
    }

    async function firstPage() {
      const { openPdf, renderPdfCanvas, canvasBytes } = await import("@/lib/pdf-render");
      if (cancelled) return;
      const task = await openPdf(blob);
      let destroyed = false;
      destroy = async () => {
        if (destroyed) return;
        destroyed = true;
        await task.destroy();
      };
      try {
        if (cancelled) { void task.promise.catch(() => {}); return; }
        const document = await task.promise;
        const page = await document.getPage(1);
        if (cancelled) return;
        const { canvas } = await renderPdfCanvas(page, 160);
        try {
          show(await canvasBytes(canvas));
        } finally {
          canvas.width = canvas.height = 0;
        }
      } finally {
        await destroy();
      }
    }

    if (kind === "pdf") void firstPage().catch(() => { /* Leave the file icon visible. */ });
    else show(blob);

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      if (destroy) void destroy().catch(() => {});
    };
  }, [blob, kind, ready]);

  const url = preview?.blob === blob ? preview.url : undefined;
  return (
    <span ref={root} className="studio-thumbnail-image">
      {url && (kind === "video" ?
        <video key={url} src={url} muted playsInline preload="auto" onLoadedData={event => { event.currentTarget.dataset.loaded = "true"; }} /> :
        // eslint-disable-next-line @next/next/no-img-element -- Thumbnails use local object URLs.
        <img key={url} src={url} alt="" decoding="async" onLoad={event => { event.currentTarget.dataset.loaded = "true"; }} />)}
    </span>
  );
}

export function ToolFile({ blob, name, detail }: { blob: Blob; name: string; detail?: string }) {
  return (
    <div className="studio-file">
      <FileThumbnail blob={blob} name={name} />
      <div className="min-w-0">
        <p className="wrap-anywhere text-sm font-semibold">{name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{formatBytes(blob.size)}{detail && " · " + detail}</p>
      </div>
    </div>
  );
}
