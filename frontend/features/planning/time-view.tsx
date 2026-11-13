"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { hhmm, iso, minutes } from "./dates";
import { barEnds, Chip, hiddenOn, MAX_LANES, More, onDay, SHADE, timed, weekBars, type Draft, type Item } from "./items";

const HOUR = 56; // px
const STEP = 15; // minutes a drag snaps to
const DAY = 24 * 60;

/** An item's minutes on `day`: a timed item running over several days is cut at midnight. */
const span = (item: Item, day: string): [number, number] => [
  item.from === day ? minutes(item.start!) : 0,
  item.to === day ? minutes(item.end!) : DAY,
];

/** Side-by-side lanes for overlapping items. ponytail: one width per day, per-cluster widths if days get crowded. */
function lanes(items: Item[], day: string) {
  const ends: number[] = [];
  const placed = items
    .map((item) => ({ item, range: span(item, day) }))
    .sort((a, b) => a.range[0] - b.range[0])
    .map(({ item, range }) => {
      let lane = ends.findIndex((end) => end <= range[0]);
      if (lane < 0) lane = ends.push(0) - 1;
      ends[lane] = range[1];
      return { item, range, lane };
    });
  return { placed, count: Math.max(ends.length, 1) };
}

/** Days split into hours (one day, or a week); dragging over the hours drafts a timed event. */
export function TimeView({ days, items, onCreate }: { days: Date[]; items: Item[]; onCreate?: (draft: Draft) => void }) {
  const { t, lang } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ day: string; a: number; b: number } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const today = iso(now);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 7 * HOUR - 12 }); // 07:00 and its label in view
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const at = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(Math.max(Math.floor((((e.clientY - rect.top) / rect.height) * DAY) / STEP) * STEP, 0), DAY - STEP);
  };
  const [lo, hi] = drag ? [Math.min(drag.a, drag.b), Math.max(drag.a, drag.b) + STEP] : [0, 0];
  // Whole-day items as bars across the days. One day shows them all: it is where "+N" leads.
  const all = days.length === 1;
  const band = weekBars(items.filter((item) => !timed(item)), days.map(iso));
  const bandLanes = Math.max(0, ...band.map((bar) => bar.lane + 1));
  const hiddenIn = (column: number) => (all ? 0 : hiddenOn(band, column));
  const rows = all ? bandLanes : Math.min(MAX_LANES, bandLanes);
  const bandHeight = Math.max(40, rows * 28 + 8 + (days.some((_, c) => hiddenIn(c) > 0) ? 22 : 0));
  const cols = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <div className={cn(days.length > 1 && "min-w-[720px]")}>
        <div className="grid border-b" style={cols}>
          <div />
          {days.map((d) => (
            <div key={iso(d)} className={cn("flex items-center gap-2 border-l px-3 py-2", iso(d) === today ? "text-primary" : "text-muted-foreground")}>
              <span className="text-xs font-semibold uppercase tracking-wide">{d.toLocaleDateString(lang, { weekday: "short" })}</span>
              <span className={cn("grid size-8 place-items-center rounded-full text-lg font-semibold text-foreground", iso(d) === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
            </div>
          ))}
        </div>
        <div className="grid border-b" style={cols}>
          <div className="px-1.5 py-2 text-right text-[10px] leading-tight text-muted-foreground">{t("planning.allDay")}</div>
          <div className="relative" style={{ gridColumn: `span ${days.length}`, height: bandHeight }}>
            <div aria-hidden className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d) => (
                <div key={iso(d)} className={cn("border-l", iso(d) === today && SHADE.today)} />
              ))}
            </div>
            {band
              .filter((bar) => all || bar.lane < MAX_LANES)
              .map((bar) => (
                <Chip
                  key={bar.item.key}
                  item={bar.item}
                  className={cn("absolute h-6", barEnds(bar))}
                  style={{ top: 6 + bar.lane * 28, left: `calc(${(bar.start / days.length) * 100}% + 4px)`, width: `calc(${(bar.span / days.length) * 100}% - 8px)` }}
                />
              ))}
            {days.map((d, column) => {
              return hiddenIn(column) > 0 ? (
                <div key={iso(d)} className="absolute bottom-0.5" style={{ left: `calc(${(column / days.length) * 100}% + 4px)` }}>
                  <More bars={band} column={column} date={d} />
                </div>
              ) : null;
            })}
          </div>
        </div>
        <div ref={scroller} className="max-h-[640px] overflow-y-auto">
          <div className="grid" style={cols}>
            <div className="relative" style={{ height: 24 * HOUR }}>
              {Array.from({ length: 23 }, (_, h) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground" style={{ top: (h + 1) * HOUR }}>
                  {hhmm((h + 1) * 60)}
                </span>
              ))}
            </div>
            {days.map((d) => {
              const day = iso(d);
              const { placed, count } = lanes(items.filter((item) => timed(item) && onDay(item, day)), day);
              const label = d.toLocaleDateString(lang, { dateStyle: "full" });
              return (
                <div
                  key={day}
                  role="group"
                  aria-label={label}
                  className={cn("relative touch-none select-none border-l", d.getDay() % 6 === 0 && SHADE.quiet, day === today && SHADE.today, onCreate && "cursor-cell")}
                  style={{ height: 24 * HOUR, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR - 1}px, var(--border) ${HOUR - 1}px ${HOUR}px)` }}
                  onPointerDown={(e) => {
                    if (!onCreate || e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const m = at(e);
                    setDrag({ day, a: m, b: m });
                  }}
                  onPointerMove={(e) => drag?.day === day && setDrag({ ...drag, b: at(e) })}
                  onPointerUp={() => {
                    // A click without a drag drafts one hour.
                    if (drag) onCreate?.({ start_date: day, end_date: day, start_time: hhmm(lo), end_time: hhmm(hi === lo + STEP ? Math.min(lo + 60, DAY) : hi) });
                    setDrag(null);
                  }}
                  onPointerCancel={() => setDrag(null)}
                >
                  {placed.map(({ item, range: [from, to], lane }) => (
                    <div
                      key={item.key}
                      className="absolute px-1 py-px"
                      style={{ top: (from / 60) * HOUR, height: Math.max(((to - from) / 60) * HOUR, 22), left: `${(lane / count) * 100}%`, width: `${100 / count}%` }}
                    >
                      <Chip item={item} block className="size-full overflow-hidden shadow-sm" />
                    </div>
                  ))}
                  {drag?.day === day && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0.5 rounded border border-primary bg-primary/15 px-1 text-[10px] tabular-nums text-primary" style={{ top: (lo / 60) * HOUR, height: ((hi - lo) / 60) * HOUR }}>
                      {hhmm(lo)} – {hhmm(hi)}
                    </div>
                  )}
                  {day === today && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger before:absolute before:-left-1 before:-top-1 before:size-2.5 before:rounded-full before:bg-danger" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
