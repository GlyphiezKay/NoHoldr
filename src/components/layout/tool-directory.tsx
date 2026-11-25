"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LayoutGrid, Search, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { matchesTool, type DirectoryGroup } from "@/lib/tool-directory";
import { ToolGroup } from "./tool-group";
import { ToolDirectoryHeader } from "./tool-directory-header";
import styles from "./tool-directory.module.css";

export function ToolDirectory({
  tone, title, description, icon: Icon, groups, shortcuts,
}: {
  tone: "pdf" | "image";
  title: string;
  description: string;
  icon: LucideIcon;
  groups: DirectoryGroup[];
  shortcuts: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const tools = groups.flatMap(group => group.tools);
  const visibleGroups = groups.filter(group => !category || group.title === category)
    .map(group => ({ ...group, tools: group.tools.filter(tool => matchesTool(tool, query)) }))
    .filter(group => group.tools.length > 0);
  const count = visibleGroups.reduce((sum, group) => sum + group.tools.length, 0);
  const isFiltering = Boolean(category || query.trim());
  const documentType = tone === "pdf" ? "PDF" : "image";

  return (
    <main id="main-content" className={styles.directory} data-tone={tone}>
      <ToolDirectoryHeader
        title={title} description={description} icon={Icon}
        searchLabel={tone === "pdf" ? "Find a PDF tool" : "Find an image tool"}
        placeholder={tone === "pdf" ? "Search merge, OCR, sign…" : "Search resize, crop, WebP…"}
        query={query} onChange={setQuery}
      />

      <nav className={styles.quick} aria-label="Quick access">
        <h2><Zap size={17} aria-hidden="true" /> Quick access</h2>
        <ul>
          {shortcuts.map(href => {
            const tool = tools.find(item => item.href === href);
            if (!tool) return null;
            return (
              <li key={href}>
                <Link href={href}><tool.icon size={18} aria-hidden="true" />{tool.name}<ArrowUpRight size={15} aria-hidden="true" /></Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.workbench}>
        <aside className={styles.filters} aria-labelledby="filter-heading">
          <h2 id="filter-heading">Categories</h2>
          <select className={styles.mobileFilter} aria-label="Filter by category"
            value={category} onChange={event => setCategory(event.target.value)}>
            <option value="">All tools ({tools.length})</option>
            {groups.map(group => <option key={group.title} value={group.title}>{group.title} ({group.tools.length})</option>)}
          </select>
          <ul>
            {[{ title: "", tools }, ...groups].map(group => (
              <li key={group.title}>
                <button aria-pressed={category === group.title} type="button" onClick={() => setCategory(group.title)}>
                  <span>{group.title || "All tools"}</span><span aria-hidden="true">{group.tools.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className={styles.results} aria-labelledby="results-heading">
          <div className={styles.resultsHeading}>
            <h2 id="results-heading"><LayoutGrid size={19} aria-hidden="true" />{`Browse ${documentType} tools`}</h2>
            <p role="status">{count} {count === 1 ? "tool" : "tools"}{isFiltering && " found"}</p>
          </div>
          {count === 0 && (
            <div className={styles.empty}>
              <Search size={24} aria-hidden="true" />
              <p>No tools match your filters.</p>
              <button type="button" onClick={() => { setQuery(""); setCategory(""); }}>Reset filters</button>
            </div>
          )}
          {count > 0 && (
            <div className={styles.groups} data-single={visibleGroups.length === 1}>
              {visibleGroups.map(group => <ToolGroup key={group.title} group={group} heading="h3" />)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
