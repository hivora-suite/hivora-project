"use client";

import { LABELS } from "@/features/board/labels";
import type { BoardTask, CalendarEvent } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** What a calendar shows: a card or an event, from one day to another, timed or not. */
export type Item = {
  key: string;
  title: string;
  from: string;
  to: string;
  start?: string | null;
  end?: string | null;
  hint?: string;
  label?: BoardTask["labels"][number];
  color?: CalendarEvent["color"];
  late?: boolean;
  open: () => void;
};

/** A new event's slot, chosen by dragging or with a day's "+". */
export type Draft = Pick<CalendarEvent, "start_date" | "end_date" | "start_time" | "end_time"> & { days?: string[] };

export const onDay = (item: Item, day: string) => item.from <= day && day <= item.to;
export const timed = (item: Item) => !!item.start && !!item.end;

/** An event's own colour: a tint and a side bar, both from its label token. */
export const tint = (color?: CalendarEvent["color"]) =>
  color && { background: `color-mix(in oklch, var(--label-${color}) 18%, var(--card))`, borderLeft: `3px solid var(--label-${color})` };

export function Chip({ item, className }: { item: Item; className?: string }) {
  return (
    <button
      type="button"
      onClick={item.open}
      onPointerDown={(e) => e.stopPropagation()} // a click on an item never starts a drag
      title={item.hint ? `${item.hint} · ${item.title}` : item.title}
      style={tint(item.color) || undefined}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded border px-1.5 py-0.5 text-left text-xs transition-colors hover:border-primary",
        !item.color && "bg-background",
        item.late && "font-medium text-danger",
        className,
      )}
    >
      {item.label && <span aria-hidden className={cn("size-2 shrink-0 rounded-full", LABELS[item.label])} />}
      {item.start && <span className="shrink-0 tabular-nums text-muted-foreground">{item.start}</span>}
      <span className="truncate">{item.title}</span>
      {item.hint && <span className="ml-auto shrink-0 truncate text-[10px] text-muted-foreground">{item.hint}</span>}
    </button>
  );
}
