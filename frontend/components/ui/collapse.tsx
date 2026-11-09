import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Unfolds to its content's height. Closed, it stays mounted but out of reach (invisible). */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={cn("grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out", open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0")}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
