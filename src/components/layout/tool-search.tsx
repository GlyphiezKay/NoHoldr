"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import styles from "./tool-directory.module.css";

export function ToolSearch({
  label, placeholder, query, onChange,
}: {
  label: string;
  placeholder: string;
  query: string;
  onChange: (query: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  function clear() {
    onChange("");
    input.current?.focus();
  }

  return (
    <div className={styles.search} role="search" aria-label={label}>
      <Search size={20} aria-hidden="true" />
      <input ref={input} type="search" aria-label={label} placeholder={placeholder}
        value={query} onChange={event => onChange(event.target.value)}
        onKeyDown={event => { if (event.key === "Escape" && query) clear(); }} />
      {query && <button type="button" onClick={clear} aria-label="Clear search"><X size={18} aria-hidden="true" /></button>}
    </div>
  );
}
