"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, LockKeyhole, QrCode, Zap } from "lucide-react";
import { ToolSearch } from "@/components/layout/tool-search";
import { toolCategories } from "@/lib/tool-categories";
import { imageGroups, matchesTool, pdfGroups } from "@/lib/tool-directory";
import styles from "./home.module.css";

const pdfTools = pdfGroups.flatMap(group => group.tools);
const imageTools = imageGroups.flatMap(group => group.tools);
const searchableTools = [...new Map([...imageTools, ...pdfTools].map(tool => [tool.href, tool])).values()];
const shortcuts = [
  ...searchableTools.filter(tool => ["/pdf/compress", "/image/resize", "/pdf/merge"].includes(tool.href)),
  { name: "Create a QR code", href: "/data/qr-code", icon: QrCode },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const searching = Boolean(query.trim());
  const matches = searching ? searchableTools.filter(tool => matchesTool(tool, query)) : [];
  const listedTools = searching ? matches : shortcuts;
  const [pdf, image, ...otherCategories] = toolCategories;

  return (
    <main className={styles.home} id="main-content">
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.intro}>
          <h1 id="hero-title">Your files.<br /><span>Your browser.</span></h1>
          <p>Convert, edit, and organize files right on your device.</p>
          <div className={styles.actions}>
            <Link href="/convert" className={styles.primary}><ArrowLeftRight size={18} aria-hidden="true" />Convert a file</Link>
            <a href="#tools" className={styles.secondary}>Browse tools<ArrowDownRight size={17} aria-hidden="true" /></a>
          </div>
        </div>

        <section className={styles.launcher} aria-labelledby="launcher-title">
          <h2 id="launcher-title"><Zap size={19} aria-hidden="true" /> Find a tool</h2>
          <ToolSearch label="Search PDF and image tools" placeholder="Search PDF and image tools" query={query} onChange={setQuery} />
          <p className={styles.launcherLabel} role="status">
            {searching ? `${matches.length} ${matches.length === 1 ? "tool" : "tools"} found` : "Quick access"}
          </p>
          <ul className={styles.launcherList}>
            {listedTools.map(tool => (
              <li key={tool.href}>
                <Link href={tool.href}><tool.icon size={19} aria-hidden="true" /><span>{tool.name}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>
              </li>
            ))}
          </ul>
          {searching && matches.length === 0 && <p className={styles.empty}>Try a tool name or format, such as OCR or WebP.</p>}
        </section>
      </section>

      <section id="tools" className={styles.catalog} aria-labelledby="tools-title">
        <h2 id="tools-title">Browse by category</h2>
        <ul className={styles.featured}>
          {[{ ...pdf, count: pdfTools.length }, { ...image, count: imageTools.length }].map(category => (
            <li key={category.href}>
              <Link href={category.href} className={styles.featureCard} data-tone={category.tone}>
                <span className={styles.icon}><category.icon size={25} aria-hidden="true" /></span>
                <div><h3>{category.name} tools</h3><p>{category.description}</p></div>
                <span className={styles.featureMeta}>{category.count} tools <ArrowUpRight size={18} aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className={styles.otherCategories}>
          {otherCategories.map(({ name, href, icon: Icon, description, tone }) => (
            <li key={href}>
              <Link href={href} className={styles.card} data-tone={tone}>
                <span className={styles.icon}><Icon size={20} aria-hidden="true" /></span>
                <div><h3>{name}</h3><p>{description}</p></div>
                <ArrowRight className={styles.cardArrow} size={17} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <aside className={styles.privacy}>
        <LockKeyhole size={21} aria-hidden="true" />
        <div>
          <h2>File processing stays on your device.</h2>
          <p>Optional AI tools send the content you choose directly to Google Gemini.</p>
        </div>
        <Link href="/privacy">Privacy policy</Link>
      </aside>
    </main>
  );
}
