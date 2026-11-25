import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, LockKeyhole } from "lucide-react";

type WorkspaceProps = {
  category: string;
  backHref: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function ToolWorkspace({ category, backHref, title, description, children }: WorkspaceProps) {
  return (
    <main className="mx-auto w-full max-w-[76rem] px-[18px] pt-8 pb-14 sm:px-6 lg:pt-12">
      <Link href={backHref} className="inline-flex min-h-8 items-center gap-1 rounded-md text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-2">
        <ChevronLeft className="size-4" aria-hidden="true" /> {category}
      </Link>
      <div className="mt-3 mb-7 flex flex-wrap items-end justify-between gap-4 border-b pb-6 sm:mb-9">
        <div>
          <h1 className="text-4xl leading-tight font-bold tracking-[-0.06em] sm:text-5xl">{title}</h1>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border bg-accent px-3 py-2 text-sm font-medium">
          <LockKeyhole className="size-4" aria-hidden="true" /> Runs on your device
        </span>
      </div>
      {children}
    </main>
  );
}

export function ToolPanel({ title, description, action, children }: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}