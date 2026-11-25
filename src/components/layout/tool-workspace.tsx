import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownToLine, ArrowLeftRight, ChevronLeft, Clapperboard, Cloud, Database, FileText, FolderArchive, Image, Import, LockKeyhole, SlidersHorizontal, Sparkles, type LucideIcon } from "lucide-react";
import { ThumbnailToggle } from "./thumbnail-preference";

type WorkspaceProps = {
  category: string;
  backHref: string;
  title: string;
  description: string;
  children: ReactNode;
  tone?: "pdf" | "image" | "media" | "convert" | "files" | "data" | "ai";
  thumbnails?: boolean;
};

const workspaceIcons: Partial<Record<string, LucideIcon>> = { pdf: FileText, image: Image, media: Clapperboard, files: FolderArchive, data: Database, ai: Sparkles, convert: ArrowLeftRight };
const stages = {
  input: { label: "Input", icon: Import },
  settings: { label: "Settings", icon: SlidersHorizontal },
  result: { label: "Output", icon: ArrowDownToLine },
};

export function ToolWorkspace({ category, backHref, title, description, children, tone, thumbnails }: WorkspaceProps) {
  const theme = tone ?? (backHref === "/" ? title.toLowerCase().split(" ")[0] : backHref.slice(1));
  const Icon = workspaceIcons[theme];
  const showThumbnails = thumbnails ?? ["pdf", "image", "media", "convert", "files"].includes(theme);
  return (
    <main id="main-content" data-workspace={theme} className="tool-workspace mx-auto w-full max-w-[78rem] px-4 pt-5 pb-14 sm:px-7 sm:pt-8">
      <div className="tool-intro mb-6 rounded-[1.65rem] border px-5 pt-3 pb-5 sm:px-7 sm:pt-4 sm:pb-6">
        <Link href={backHref} className="studio-back inline-flex min-h-8 items-center gap-1 rounded-lg text-sm font-medium focus-visible:outline-2">
          <ChevronLeft className="size-4" aria-hidden="true" /> {category}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            {Icon && <span className="studio-mark"><Icon size={24} aria-hidden="true" /></span>}
            <div>
              <h1 className="wrap-anywhere text-[clamp(1.85rem,5vw,3.4rem)] leading-[1.04] font-bold tracking-[-0.065em]">{title}</h1>
              <p className="studio-description mt-2 max-w-2xl text-sm leading-relaxed sm:text-base">{description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showThumbnails && <ThumbnailToggle />}
            <span className="studio-local inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium">
              {theme === "ai" ? <Cloud className="size-4" aria-hidden="true" /> : <LockKeyhole className="size-4" aria-hidden="true" />}
              {theme === "ai" ? "Google Gemini" : Icon ? "On device" : "Runs on your device"}
            </span>
          </div>
        </div>
      </div>
      {children}
    </main>
  );
}

export function ToolPanel({ title, description, action, stage, children }: {
  title: string;
  description?: string;
  action?: ReactNode;
  stage?: keyof typeof stages;
  children: ReactNode;
}) {
  const step = stage ? stages[stage] : undefined;
  return (
    <section id={stage === "result" ? "tool-result" : undefined} tabIndex={stage === "result" ? -1 : undefined} data-stage={stage} className="tool-panel min-w-0 rounded-[1.35rem] border bg-card p-4 sm:p-5">
      <div className="studio-panel-header mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          {step && <p className="studio-stage"><step.icon size={15} aria-hidden="true" />{step.label}</p>}
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
