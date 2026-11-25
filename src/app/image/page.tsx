"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Aperture, Blend, Crop, Eye, FileImage, FileText, Film, Focus, Maximize2, Minimize2, Palette, RotateCw, Search, SquarePen, Stamp, Trash2, Type,
} from "lucide-react";
import { ToolWorkspace } from "@/components/layout/tool-workspace";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const groups = [
  { title: "Size and dimensions", tools: [
    { title: "Compress Images", href: "/image/compress", icon: Minimize2, description: "Batch compress by quality or target KB per image." },
    { title: "Resize Images", href: "/image/resize", icon: Maximize2, description: "Set exact sizes, fit within a box, or use a percentage." },
    { title: "Upscale Images", href: "/image/upscale", icon: Focus, description: "Enlarge images up to 4× with high-quality resampling." },
  ] },
  { title: "Edit and create", tools: [
    { title: "Crop Images", href: "/image/crop", icon: Crop, description: "Select a crop by hand or apply a batch crop." },
    { title: "Rotate and Flip", href: "/image/rotate", icon: RotateCw, description: "Rotate or mirror multiple images in one batch." },
    { title: "Photo Editor", href: "/image/edit", icon: SquarePen, description: "Adjust colors and exposure or place a caption." },
    { title: "Watermark Images", href: "/image/watermark", icon: Stamp, description: "Add a text watermark or logo." },
    { title: "Meme Generator", href: "/image/meme", icon: Type, description: "Add customizable top and bottom text." },
    { title: "Make Animated GIF", href: "/image/gif", icon: Film, description: "Turn ordered images into a looping animation." },
    { title: "Extract Colors", href: "/data/color-extractor", icon: Palette, description: "Inspect the colors in an image." },
  ] },
  { title: "Convert and export", tools: [
    { title: "Convert Images", href: "/image/convert", icon: FileImage, description: "Convert a batch to JPEG, WebP, PNG, BMP, GIF, ICO, or other available formats." },
    { title: "Images to PDF", href: "/pdf/from-images", icon: FileText, description: "Combine images into a PDF, one image per page." },
    { title: "HTML to Image", href: "/image/html", icon: FileImage, description: "Render local HTML into a PNG or JPEG." },
  ] },
  { title: "Privacy and cleanup", tools: [
    { title: "Hide Image Areas", href: "/image/blur", icon: Aperture, description: "Pixelate or cover selected regions such as faces and license plates." },
    { title: "Remove Color Background", href: "/image/remove-background", icon: Blend, description: "Remove a selected background color and export transparency." },
    { title: "View Image Metadata", href: "/image/metadata", icon: Eye, description: "Inspect available EXIF, GPS, XMP, and IPTC tags." },
    { title: "Remove Image Metadata", href: "/image/remove-metadata", icon: Trash2, description: "Re-encode image pixels to remove source metadata in a batch." },
  ] },
];

export default function ImageToolsPage() {
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = groups.map(group => ({ ...group, tools: group.tools.filter(tool =>
    words.every(word => (tool.title + " " + tool.description).toLowerCase().includes(word))) })).filter(group => group.tools.length);
  const count = filtered.reduce((sum, group) => sum + group.tools.length, 0);

  return (
    <ToolWorkspace category="All tools" backHref="/" title="Image tools" description="Compress, resize, edit, and export images without uploading them.">
      <div className="relative mb-6 max-w-lg">
        <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" />
        <Input value={query} onChange={event => setQuery(event.target.value)} className="h-10 bg-card pl-9" type="search" aria-label="Find an image tool" placeholder="Find an image tool" />
      </div>
      {words.length > 0 && <p role="status" className="mb-3 text-sm text-muted-foreground">{count} {count === 1 ? "tool" : "tools"} found</p>}
      {!count && <Button variant="outline" onClick={() => setQuery("")}>Clear search</Button>}
      <div className="space-y-8">
        {filtered.map(group => <section key={group.title}>
          <h2 className="mb-3 text-xl font-semibold tracking-tight">{group.title}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.tools.map(({ title, href, icon: Icon, description }) => <li key={href}>
              <Link href={href} className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-ring hover:bg-accent focus-visible:outline-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary"><Icon className="size-5" aria-hidden="true" /></span>
                <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p></div>
              </Link>
            </li>)}
          </ul>
        </section>)}
      </div>
    </ToolWorkspace>
  );
}
