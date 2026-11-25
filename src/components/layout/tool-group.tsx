import Link from "next/link";
import type { DirectoryGroup } from "@/lib/tool-directory";
import styles from "./tool-group.module.css";

export function ToolGroup({ group, heading: Heading = "h2" }: {
  group: DirectoryGroup;
  heading?: "h2" | "h3";
}) {
  const { title, icon: Icon, tone, tools } = group;

  return (
    <section data-tone={tone} className="min-w-0 overflow-hidden rounded-[1.65rem] border bg-card">
      <div className={`flex items-center gap-3 px-5 py-5 sm:px-7 ${styles.tint}`}>
        <Icon className="size-6 shrink-0" aria-hidden="true" />
        <Heading className="text-2xl font-semibold tracking-tight">{title}</Heading>
      </div>
      <ul className="divide-y px-3 py-1 sm:px-5">
        {tools.map(({ name, href, icon: ToolIcon, description }) => (
          <li key={href}>
            <Link href={href} className="my-1 flex items-center gap-4 rounded-2xl px-3 py-3.5 transition-colors hover:bg-accent focus-visible:outline-2 sm:px-4">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${styles.tint}`}><ToolIcon className="size-5" aria-hidden="true" /></span>
              <span>
                <span className="block font-semibold">{name}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
