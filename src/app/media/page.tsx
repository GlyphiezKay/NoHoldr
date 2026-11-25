"use client";

import { useState } from "react";
import { AudioLines, Clapperboard, FileAudio, Gauge, Image, Music, Scissors, Search, Video } from "lucide-react";
import { ToolDirectoryHeader } from "@/components/layout/tool-directory-header";
import { ToolGroup } from "@/components/layout/tool-group";
import { matchesTool, type DirectoryGroup } from "@/lib/tool-directory";
import styles from "@/components/layout/tool-directory.module.css";

const groups: DirectoryGroup[] = [
  { title: "Video", icon: Clapperboard, tone: "blue", tools: [
    { name: "Compress video", href: "/media/video-compress", icon: Gauge, description: "Adjust resolution and bitrate, then compare the file sizes." },
    { name: "Trim video", href: "/media/video-trim", icon: Scissors, description: "Pick exact start and end times for a clip." },
    { name: "Convert video", href: "/media/video-convert", icon: Video, description: "Export WebM with a choice of VP8 or VP9." },
    { name: "Extract frame", href: "/media/frame", icon: Image, description: "Save a frame as PNG or JPEG." },
  ] },
  { title: "Audio", icon: AudioLines, tone: "green", tools: [
    { name: "Trim audio", href: "/media/audio-trim", icon: Scissors, description: "Preview an exact range and save a WAV clip." },
    { name: "Convert audio", href: "/media/audio-convert", icon: FileAudio, description: "Export WAV and choose the bit depth and channels." },
    { name: "Extract audio", href: "/media/extract-audio", icon: Music, description: "Save the sound from a video as WAV." },
  ] },
];

export default function MediaToolsPage() {
  const [query, setQuery] = useState("");
  const visibleGroups = groups
    .map(group => ({ ...group, tools: group.tools.filter(tool =>
      matchesTool(tool, query) || group.title.toLowerCase().includes(query.trim().toLowerCase())
    ) }))
    .filter(group => group.tools.length > 0);
  const count = visibleGroups.reduce((total, group) => total + group.tools.length, 0);

  return (
    <main id="main-content" className={styles.directory} data-tone="media">
      <ToolDirectoryHeader
        title="Media tools"
        description="Trim, compress, and convert audio or video right in your browser."
        icon={Clapperboard}
        searchLabel="Find a media tool"
        placeholder="Search trim, convert, WAV…"
        query={query} onChange={setQuery}
      />
      <p role="status" className="sr-only">{count} {count === 1 ? "tool" : "tools"} found</p>
      {count > 0 ? (
        <div className={styles.groups} data-single={visibleGroups.length === 1}>
          {visibleGroups.map(group => <ToolGroup key={group.title} group={group} />)}
        </div>
      ) : (
        <div className={styles.empty}>
          <Search size={24} aria-hidden="true" />
          <p>No media tools match your search.</p>
        </div>
      )}
    </main>
  );
}
