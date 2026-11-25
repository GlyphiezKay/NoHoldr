import Link from "next/link";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { ToolSearch } from "./tool-search";
import styles from "./tool-directory.module.css";

export function ToolDirectoryHeader({
  title, description, icon: Icon, searchLabel, placeholder, query, onChange,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  searchLabel: string;
  placeholder: string;
  query: string;
  onChange: (query: string) => void;
}) {
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/"><ArrowLeft size={15} aria-hidden="true" /> All tools</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{title}</span>
      </nav>

      <header className={styles.banner}>
        <div>
          <span className={styles.bannerIcon}><Icon size={25} aria-hidden="true" /></span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <ToolSearch label={searchLabel} placeholder={placeholder} query={query} onChange={onChange} />
      </header>
    </>
  );
}
