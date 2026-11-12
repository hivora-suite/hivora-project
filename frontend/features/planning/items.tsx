"use client";

import type { CSSProperties } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import type { CalendarEvent } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n";
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
  color?: CalendarEvent["color"]; // an event's colour, or a card's first label
  late?: boolean;
  done?: boolean; // a validated card
  open: () => void;
};

/** A new event's slot, chosen by dragging or with a day's "+". */
export type Draft = Pick<CalendarEvent, "start_date" | "end_date" | "start_time" | "end_time"> & { days?: string[] };

export const onDay = (item: Item, day: string) => item.from <= day && day <= item.to;
export const timed = (item: Item) => !!item.start && !!item.end;

/** An item's colour: a tint and a side bar, both from its label token. */
export const tint = (color?: CalendarEvent["color"]) =>
  color && { background: `color-mix(in oklch, var(--label-${color}) 18%, var(--card))`, borderLeft: `3px solid var(--label-${color})` };

export function Chip({ item, className, style }: { item: Item; className?: string; style?: CSSProperties }) {
  return (
    <button
      type="button"
      onClick={item.open}
      onPointerDown={(e) => e.stopPropagation()} // a click on an item never starts a drag
      title={item.hint ? `${item.hint} · ${item.title}` : item.title}
      style={{ ...(tint(item.color) || {}), ...style }}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded border px-1.5 py-0.5 text-left text-xs transition-colors hover:border-primary",
        !item.color && "bg-background",
        item.late && !item.done && "font-medium text-danger",
        item.done && "text-muted-foreground line-through decoration-1",
        className,
      )}
    >
      {item.start && <span className="shrink-0 tabular-nums text-muted-foreground">{item.start}</span>}
      <span className="truncate">{item.title}</span>
      {item.hint && <span className="ml-auto shrink-0 truncate text-[10px] text-muted-foreground">{item.hint}</span>}
    </button>
  );
}

/** At most this many rows of bars in a day; the rest is counted in a "+N". */
export const MAX_LANES = 3;

/** An item as one bar across a week: from column `start` for `span` days, on row `lane`;
 *  `cutStart` / `cutEnd`: it goes on before or after this week. */
export type Bar = { item: Item; start: number; span: number; lane: number; cutStart: boolean; cutEnd: boolean };

/** The bars of a run of consecutive days (a week, or one day): longest first among those
 *  starting together, each on the first row free from its first day. */
export function weekBars(items: Item[], days: string[]): Bar[] {
  const [first, last] = [days[0], days[days.length - 1]];
  const ends: number[] = [];
  return items
    .filter((item) => item.from <= last && item.to >= first)
    .sort((a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to) || a.key.localeCompare(b.key))
    .map((item) => {
      const start = item.from < first ? 0 : days.indexOf(item.from);
      const end = item.to > last ? days.length - 1 : days.indexOf(item.to);
      let lane = ends.findIndex((e) => e < start);
      if (lane < 0) lane = ends.push(0) - 1;
      ends[lane] = end;
      return { item, start, span: end - start + 1, lane, cutStart: item.from < first, cutEnd: item.to > last };
    });
}

/** How many bars a day hides beyond MAX_LANES. */
export const hiddenOn = (bars: Bar[], column: number) =>
  bars.filter((b) => b.lane >= MAX_LANES && b.start <= column && column < b.start + b.span).length;

/** A bar's ends: square where it goes on into the previous or next week. */
export const barEnds = (bar: Bar) => cn(bar.cutStart && "rounded-l-none", bar.cutEnd && "rounded-r-none");

/** "+N": a menu of the items a day hides, each opening as from the calendar. */
export function More({ bars, column, date }: { bars: Bar[]; column: number; date: Date }) {
  const { t, lang } = useI18n();
  const hidden = bars.filter((b) => b.lane >= MAX_LANES && b.start <= column && column < b.start + b.span).map((b) => b.item);
  if (!hidden.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("planning.moreLabel", { count: hidden.length, day: date.toLocaleDateString(lang, { dateStyle: "full" }) })}
        onPointerDown={(e) => e.stopPropagation()} // never starts a drag on the day
        className="rounded px-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {t("planning.more", { count: hidden.length })}
      </DropdownMenuTrigger>
      {/* React events bubble out of the portal: a press in the menu must not reach the day. */}
      <DropdownMenuContent align="start" className="w-64" onPointerDown={(e) => e.stopPropagation()}>
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground first-letter:uppercase">
          {date.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}
        </div>
        {hidden.map((item) => (
          <DropdownMenuItem key={item.key} onSelect={item.open} className={cn(item.done && "text-muted-foreground line-through")}>
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm border" style={{ background: item.color ? `var(--label-${item.color})` : undefined }} />
            {item.start && <span className="shrink-0 tabular-nums text-muted-foreground">{item.start}</span>}
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            {item.hint && <span className="shrink-0 truncate text-[10px] text-muted-foreground">{item.hint}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
