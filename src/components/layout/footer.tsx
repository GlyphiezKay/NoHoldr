import Link from "next/link";
import { Wordmark } from "./wordmark";

const links = [
  { name: "About", href: "/about" },
  { name: "Privacy", href: "/privacy" },
  { name: "Legal", href: "/legal" },
  { name: "FAQ", href: "/faq" },
];

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-[76rem] flex-col gap-5 px-[18px] py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Wordmark />
          <span className="text-sm text-muted-foreground">by GlyphiezKay</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3">
          {links.map(({ name, href }) => (
            <Link key={href} href={href} className="rounded text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4">{name}</Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}