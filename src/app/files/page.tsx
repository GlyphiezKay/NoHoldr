"use client";

import { Archive, ArchiveRestore, Copy, FilePenLine, FolderArchive, Hash } from "lucide-react";
import { UtilityDirectory } from "@/components/layout/utility-directory";
import type { DirectoryGroup } from "@/lib/tool-directory";

const groups: DirectoryGroup[] = [
  { title: "Archives", icon: FolderArchive, tone: "amber", tools: [
    { name: "Create ZIP", href: "/files/zip", icon: Archive, description: "Bundle files and download them as one ZIP." },
    { name: "Extract ZIP", href: "/files/unzip", icon: ArchiveRestore, description: "Open an archive and download the entries you need." },
  ] },
  { title: "Organize and verify", icon: FilePenLine, tone: "green", tools: [
    { name: "Batch Rename", href: "/files/rename", icon: FilePenLine, description: "Preview new names and save all the renamed files." },
    { name: "Find Duplicates", href: "/files/duplicates", icon: Copy, description: "Compare file contents to find identical copies." },
    { name: "File Hash", href: "/files/hash", icon: Hash, description: "Calculate the SHA-256 checksum for each file." },
  ] },
];

export default function FilesToolsPage() {
  return <UtilityDirectory tone="files" title="File tools" description="Manage archives, rename files, and verify their contents on your device." icon={FolderArchive} groups={groups} />;
}
