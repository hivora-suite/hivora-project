"use client";

import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { readPref, writePref } from "@/lib/prefs";
import { cn } from "@/lib/utils";

import { addDays, iso, weekStart } from "./dates";
import type { Draft, Item } from "./items";
import { MonthView } from "./month-view";
import { TimeView } from "./time-view";
import { YearView } from "./year-view";

const VIEWS = ["day", "week", "month", "year"] as const;
type View = (typeof VIEWS)[number];

/** The calendar of both plannings: a view, the period it shows, and its items. The view is remembered in this browser. */
export function Planner({ items, onCreate }: { items: Item[]; onCreate?: (draft: Draft) => void }) {
  const { t, lang } = useI18n();
  const [view, setViewState] = useState<View>(() => VIEWS.find((v) => v === readPref("planning.view")) ?? "month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [picked, setPicked] = useState<string[]>([]);
  const [key, setKey] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setKey("⌘");
  }, []);
  useEffect(() => {
    if (!picked.length) return;
    const clear = (e: KeyboardEvent) => e.key === "Escape" && setPicked([]);
    window.addEventListener("keydown", clear);
    return () => window.removeEventListener("keydown", clear);
  }, [picked.length]);
  const setView = (v: View) => {
    setViewState(v);
    writePref("planning.view", v);
  };
  const shift = (n: number) =>
    setAnchor((a) =>
      view === "day" ? addDays(a, n) : view === "week" ? addDays(a, 7 * n) : view === "month" ? new Date(a.getFullYear(), a.getMonth() + n, 1) : new Date(a.getFullYear() + n, a.getMonth(), 1),
    );
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i));
  const title =
    view === "day"
      ? anchor.toLocaleDateString(lang, { dateStyle: "full" })
      : view === "week"
        ? new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).formatRange(week[0], week[6])
        : view === "month"
          ? anchor.toLocaleDateString(lang, { month: "long", year: "numeric" })
          : String(anchor.getFullYear());
  const today = iso(new Date());

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label={t("planning.previous")} title={t("planning.previous")} onClick={() => shift(-1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" onClick={() => setAnchor(new Date())}>
          {t("planning.today")}
        </Button>
        <Button variant="outline" size="icon" aria-label={t("planning.next")} title={t("planning.next")} onClick={() => shift(1)}>
          <ChevronRight />
        </Button>
        <h2 aria-live="polite" className="ml-2 text-lg font-semibold first-letter:uppercase">
          {title}
        </h2>
        <div role="group" aria-label={t("planning.view")} className="ml-auto flex rounded-md border p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn("rounded px-2.5 py-1 text-sm transition-colors", view === v ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {t(`planning.view.${v}`)}
            </button>
          ))}
        </div>
        {onCreate && (
          <Button onClick={() => onCreate({ start_date: today, end_date: today, start_time: null, end_time: null })}>
            <Plus /> {t("planning.newEvent")}
          </Button>
        )}
      </div>
      {onCreate && view !== "year" && (
        <div aria-live="polite" className="-mt-1 flex min-h-8 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {view === "month" && picked.length > 0 ? (
            <>
              <span className="font-medium text-foreground">{t(picked.length === 1 ? "planning.pickedOne" : "planning.picked", { count: picked.length })}</span>
              <span>· {t("planning.pickedHint", { key })}</span>
              <Button
                size="sm"
                onClick={() => {
                  onCreate({ start_date: picked[0], end_date: picked[0], start_time: null, end_time: null, days: picked });
                  setPicked([]);
                }}
              >
                <Plus /> {t("planning.createOnDays")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
                <X /> {t("planning.clearPicked")}
              </Button>
            </>
          ) : (
            <span>{t(view === "month" ? "planning.hint.month" : "planning.hint.time", { key })}</span>
          )}
        </div>
      )}
      {view === "month" && <MonthView anchor={anchor} items={items} onCreate={onCreate} picked={picked} onPick={setPicked} />}
      {view === "week" && <TimeView days={week} items={items} onCreate={onCreate} />}
      {view === "day" && <TimeView days={[anchor]} items={items} onCreate={onCreate} />}
      {view === "year" && (
        <YearView
          anchor={anchor}
          items={items}
          onPick={(d) => {
            setAnchor(d);
            setView("day");
          }}
        />
      )}
    </>
  );
}
