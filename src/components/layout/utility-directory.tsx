"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { matchesTool, type DirectoryGroup } from "@/lib/tool-directory";
import { ToolDirectoryHeader } from "./tool-directory-header";
import { ToolGroup } from "./tool-group";
import styles from "./tool-directory.module.css";

export function UtilityDirectory({ tone, title, description, icon, groups, children }: {
  tone: "files" | "data" | "ai";
  title: string;
  description: string;
  icon: LucideIcon;
  groups: DirectoryGroup[];
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const filtered = groups.map(group => ({ ...group, tools: group.tools.filter(tool => matchesTool(tool, query)) }))
    .filter(group => group.tools.length);
  const count = filtered.reduce((sum, group) => sum + group.tools.length, 0);
  return (
    <main id="main-content" className={styles.directory} data-tone={tone}>
      <ToolDirectoryHeader title={title} description={description} icon={icon} searchLabel={"Search " + title}
        placeholder={"Search " + title.toLowerCase() + "…"} query={query} onChange={setQuery} />
      {children && <div className="mt-5">{children}</div>}
      <p role="status" className="sr-only">{count} {count === 1 ? "tool" : "tools"} found</p>
      {filtered.length ? (
        <div className={styles.groups} data-single={filtered.length === 1}>
          {filtered.map(group => <ToolGroup key={group.title} group={group} />)}
        </div>
      ) : <p className={styles.empty}>No tools match your search.</p>}
    </main>
  );
}
