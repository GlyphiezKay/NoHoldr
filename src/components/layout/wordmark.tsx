import Link from "next/link";
import { PanelsTopLeft } from "lucide-react";

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center gap-2.5 rounded-md text-xl font-bold tracking-[-0.055em] focus-visible:outline-2 focus-visible:outline-offset-4">
      <span className="grid size-8 place-items-center rounded-[9px] bg-[#d8fb46] text-[#1b2213]">
        <PanelsTopLeft className="size-4.5" aria-hidden="true" />
      </span>
      NoHoldr
    </Link>
  );
}