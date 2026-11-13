"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { addDays, iso, monthDays, parse } from "./dates";
import { barEnds, Chip, MAX_LANES, More, SHADE, weekBars, type Draft, type Item } from "./items";

const dayAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-day]")?.dataset.day;

/** The days from `lo` to `hi`. */
const range = (lo: string, hi: string) => {
  const out: string[] = [];
  for (let d = parse(lo); iso(d) <= hi; d = addDays(d, 1)) out.push(iso(d));
  return out;
};

/** A month in whole weeks. Dragging across days (mouse or pen) drafts a whole-day event;
 *  with Ctrl or Cmd, a click or a drag adds days to `picked` instead, or takes one out. */
export function MonthView({ anchor, items, onCreate, picked, onPick }: {
  anchor: Date;
  items: Item[];
  onCreate?: (draft: Draft) => void;
  picked: string[];
  onPick: (days: string[]) => void;
}) {
  const { t, lang } = useI18n();
  const [drag, setDrag] = useState<{ a: string; b: string; add: boolean } | null>(null);
  const toggle = (day: string) => onPick(picked.includes(day) ? picked.filter((d) => d !== day) : [...picked, day].sort());
  const today = iso(new Date());
  const days = monthDays(anchor.getFullYear(), anchor.getMonth());
  // Each week's bars: an item over several days is one bar, drawn from its first day there.
  const weeks = Array.from({ length: days.length / 7 }, (_, w) => weekBars(items, days.slice(w * 7, w * 7 + 7).map(iso)));
  const [lo, hi] = drag ? [drag.a, drag.b].sort() : ["", ""];
  const finish = () => {
    if (drag?.add) {
      if (lo === hi) toggle(lo);
      else onPick([...new Set([...picked, ...range(lo, hi)])].sort());
    } else if (drag) onCreate?.({ start_date: lo, end_date: hi, start_time: null, end_time: null });
    setDrag(null);
  };

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[640px] select-none grid-cols-7 gap-px overflow-hidden rounded-md border bg-border"
        onPointerMove={(e) => {
          const day = drag && dayAt(e.clientX, e.clientY);
          if (day && day !== drag.b) setDrag({ ...drag, b: day });
        }}
        onPointerUp={finish}
        onPointerCancel={() => setDrag(null)}
      >
        {days.slice(0, 7).map((d) => (
          <div key={d.getDay()} aria-hidden className="bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {d.toLocaleDateString(lang, { weekday: "short" })}
          </div>
        ))}
        {days.map((d, index) => {
          const day = iso(d);
          const [bars, column] = [weeks[Math.floor(index / 7)], index % 7];
          const label = d.toLocaleDateString(lang, { dateStyle: "full" });
          return (
            <div
              key={day}
              data-day={day}
              role="group"
              aria-label={picked.includes(day) ? t("planning.pickedDay", { day: label }) : label}
              onPointerDown={(e) => onCreate && e.button === 0 && e.pointerType !== "touch" && setDrag({ a: day, b: day, add: e.ctrlKey || e.metaKey })}
              className={cn(
                "group relative min-h-36 bg-card p-2",
                (d.getDay() % 6 === 0 || d.getMonth() !== anchor.getMonth()) && SHADE.quiet,
                d.getMonth() !== anchor.getMonth() && "text-muted-foreground",
                day === today && SHADE.today,
                onCreate && "cursor-cell",
                ((drag && lo <= day && day <= hi) || picked.includes(day)) && "bg-primary/15",
                picked.includes(day) && "ring-2 ring-inset ring-primary",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("grid size-7 place-items-center rounded-full text-sm font-medium", day === today && "bg-primary font-semibold text-primary-foreground")}>
                  {d.getDate()}
                </span>
                {onCreate && (
                  <button
                    type="button"
                    aria-label={t("planning.addOn", { day: label })}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => (e.ctrlKey || e.metaKey ? toggle(day) : onCreate({ start_date: day, end_date: day, start_time: null, end_time: null }))}
                    className="grid size-5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Plus className="size-3.5" />
                  </button>
                )}
              </div>
              {bars
                .filter((bar) => bar.start === column && bar.lane < MAX_LANES)
                .map((bar) => (
                  <Chip
                    key={bar.item.key}
                    item={bar.item}
                    className={cn("absolute z-10 h-6", barEnds(bar))}
                    style={{ top: 42 + bar.lane * 28, left: 6, width: `calc(${bar.span * 100}% + ${bar.span - 1}px - 12px)` }}
                  />
                ))}
              <div className="absolute bottom-1.5 left-2">
                <More bars={bars} column={column} date={d} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
