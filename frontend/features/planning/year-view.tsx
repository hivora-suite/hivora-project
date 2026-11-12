"use client";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { iso, monthDays } from "./dates";
import { onDay, type Item } from "./items";

/** Twelve small months; a day with something on it has a dot, and opens in the day view. */
export function YearView({ anchor, items, onPick }: { anchor: Date; items: Item[]; onPick: (day: Date) => void }) {
  const { t, lang } = useI18n();
  const today = iso(new Date());
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
      {Array.from({ length: 12 }, (_, m) => (
        <section key={m} aria-label={new Date(anchor.getFullYear(), m, 1).toLocaleDateString(lang, { month: "long", year: "numeric" })} className="rounded-md border bg-card p-2">
          <h3 className="mb-1 px-1 text-sm font-medium capitalize">{new Date(anchor.getFullYear(), m, 1).toLocaleDateString(lang, { month: "long" })}</h3>
          <div className="grid grid-cols-7 text-center text-sm">
            {monthDays(anchor.getFullYear(), m).map((d) => {
              const day = iso(d);
              if (d.getMonth() !== m) return <span key={day} />;
              const busy = items.filter((item) => onDay(item, day)).length;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onPick(d)}
                  aria-label={busy ? t("planning.dayBusy", { day: d.toLocaleDateString(lang, { dateStyle: "full" }), count: busy }) : d.toLocaleDateString(lang, { dateStyle: "full" })}
                  className={cn("relative grid aspect-square place-items-center rounded transition-colors hover:bg-muted", day === today && "bg-primary font-semibold text-primary-foreground hover:bg-primary")}
                >
                  {d.getDate()}
                  {busy > 0 && <span aria-hidden className={cn("absolute bottom-0.5 size-1 rounded-full", day === today ? "bg-primary-foreground" : "bg-primary")} />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
