"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { addDays, iso, monthDays, parse } from "./dates";
import { Chip, onDay, type Draft, type Item } from "./items";

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
          <div key={d.getDay()} aria-hidden className="bg-card px-2 py-1.5 text-xs font-medium capitalize text-muted-foreground">
            {d.toLocaleDateString(lang, { weekday: "short" })}
          </div>
        ))}
        {days.map((d) => {
          const day = iso(d);
          const label = d.toLocaleDateString(lang, { dateStyle: "full" });
          return (
            <div
              key={day}
              data-day={day}
              role="group"
              aria-label={picked.includes(day) ? t("planning.pickedDay", { day: label }) : label}
              onPointerDown={(e) => onCreate && e.button === 0 && e.pointerType !== "touch" && setDrag({ a: day, b: day, add: e.ctrlKey || e.metaKey })}
              className={cn(
                "group flex min-h-24 flex-col gap-1 bg-card p-1.5",
                d.getMonth() !== anchor.getMonth() && "bg-muted/40 text-muted-foreground",
                onCreate && "cursor-cell",
                ((drag && lo <= day && day <= hi) || picked.includes(day)) && "bg-primary/15",
                picked.includes(day) && "ring-2 ring-inset ring-primary",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("grid size-7 place-items-center rounded-full text-sm", day === today && "bg-primary font-semibold text-primary-foreground")}>
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
              {items.filter((item) => onDay(item, day)).map((item) => (
                <Chip key={item.key} item={item} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
