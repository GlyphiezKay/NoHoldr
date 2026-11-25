"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FilePicker({ onFiles, accept, multiple, disabled, action, hint }: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  action: string;
  hint: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`rounded-xl border-2 border-dashed px-3 py-7 text-center transition-colors motion-reduce:transition-none ${dragging ? "border-primary bg-accent" : "border-border bg-background/75"}`}
      onDragOver={event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
        if (!disabled) setDragging(true);
      }}
      onDragLeave={event => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) setDragging(false);
      }}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        if (!disabled && event.dataTransfer.files.length) onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-accent text-primary">
        <Upload className="size-5" aria-hidden="true" />
      </span>
      <Button type="button" disabled={disabled} onClick={() => input.current?.click()}>{action}</Button>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
