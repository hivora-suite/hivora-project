"use client";

import { useMutationState } from "@tanstack/react-query";
import { Check, Clock } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SAVED_VISIBLE = 5000; // ms the check stays after a save

/** The card's save state: the latest change since it was opened, or text still being typed. */
export function SaveState({ typing }: { typing: boolean }) {
  const { t } = useI18n();
  const [since] = useState(Date.now);
  const statuses = useMutationState({
    filters: { predicate: (m) => m.state.submittedAt >= since },
    select: (m) => m.state.status,
  });
  const last = statuses.at(-1);
  const failed = last === "error" && !typing;
  const saving = typing || last === "pending";
  // Nothing to report until a change is made, nor once a save has been shown long enough.
  const saved = !typing && last === "success";
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSeen(statuses.length), SAVED_VISIBLE);
    return () => clearTimeout(timer);
  }, [saved, statuses.length]);
  if (!typing && (!last || (saved && seen === statuses.length))) return null;

  const label = t(failed ? "board.saveFailed" : saving ? "board.saving" : "board.saved");
  const Icon = failed || saving ? Clock : Check;
  return (
    <span role="status" aria-label={label} tabIndex={0} className={cn("group relative shrink-0 cursor-default outline-none", failed ? "text-danger" : saving ? "text-muted-foreground" : "text-ok")}>
      <Icon className="size-4" />
      <span aria-hidden className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 hidden whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs font-normal text-foreground shadow-md group-hover:block group-focus-visible:block">
        {label}
      </span>
    </span>
  );
}
