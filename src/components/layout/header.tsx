"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LockKeyhole, Menu, X } from "lucide-react";
import { toolCategories } from "@/lib/tool-categories";
import { Wordmark } from "./wordmark";

const navLink = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 aria-[current]:bg-accent aria-[current]:text-foreground";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = (href: string) => pathname === href ? "page" : pathname.startsWith(href + "/") ? "location" : undefined;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[76rem] items-center justify-between gap-4 px-[18px] sm:px-6">
        <Wordmark />
        <nav aria-label="Main navigation" className="hidden items-center gap-0.5 md:flex">
          {toolCategories.map(({ name, href }) => (
            <Link key={href} href={href} aria-current={current(href)} className={navLink}>{name}</Link>
          ))}
        </nav>
        <Link href="/privacy" aria-current={current("/privacy")} className={`hidden md:flex ${navLink}`}>
          <LockKeyhole className="size-4" aria-hidden="true" /> Privacy
        </Link>
        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          className="grid size-11 place-items-center rounded-lg hover:bg-accent focus-visible:outline-2 md:hidden"
          onClick={() => setOpen(!open)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      <div id="mobile-navigation" hidden={!open} className="border-t md:hidden">
        <nav aria-label="Mobile navigation" className="mx-auto grid max-w-md grid-cols-2 gap-1 px-[18px] py-3">
          {toolCategories.map(({ name, href, icon: Icon }) => (
            <Link key={href} href={href} aria-current={current(href)} className={navLink} onClick={() => setOpen(false)}>
              <Icon className="size-4" aria-hidden="true" /> {name}
            </Link>
          ))}
          <Link href="/privacy" aria-current={current("/privacy")} className={navLink} onClick={() => setOpen(false)}>
            <LockKeyhole className="size-4" aria-hidden="true" /> Privacy
          </Link>
        </nav>
      </div>
    </header>
  );
}