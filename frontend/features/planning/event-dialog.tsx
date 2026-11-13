"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useAsk } from "@/components/ask";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Select, Switch, Textarea } from "@/components/ui/input";
import { LABELS } from "@/features/board/labels";
import type { BoardColumn, CalendarEvent } from "@/lib/api/client";
import { boardApi, eventApi, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { Draft } from "./items";

const COLORS = Object.keys(LABELS) as CalendarEvent["color"][];

type Kanban = { id: number; columns: BoardColumn[] };

/** An event's form: `event` is the event, or the slot of a new one; a new all-day one may instead be a card in a `kanban` column (D39). */
export function EventDialog({ projectId, kanban, event, canEdit, onClose }: { projectId: number | null; kanban?: Kanban; event: CalendarEvent | Draft | null; canEdit: boolean; onClose: () => void }) {
  const { t, lang, errorMessage } = useI18n();
  const ask = useAsk();
  // ponytail: two requests, a failed update leaves an undated card; dates on card creation if that matters.
  const create = useProjectMutation(({ column, ...b }: Parameters<typeof eventApi.create>[0] & { column: number | null }) =>
    column && kanban
      ? boardApi
          .createTask({ id: kanban.id, title: b.title, column_id: column })
          .then((c) => boardApi.updateTask({ id: kanban.id, taskId: c.id, description: b.note, start_date: b.start_date, due_date: b.end_date, labels: [b.color] }))
      : eventApi.create(b),
  );
  const update = useProjectMutation(eventApi.update);
  const remove = useProjectMutation(eventApi.remove);
  const failure = create.error ?? update.error ?? remove.error;
  const old = event && "id" in event ? event : null;
  const [allDay, setAllDay] = useState(true);
  const [toKanban, setToKanban] = useState(false);
  // Days picked one by one: one independent event per day.
  const [days, setDays] = useState<string[]>([]);
  useEffect(() => {
    setAllDay(!event?.start_time);
    setToKanban(false);
    setDays(event && !("id" in event) ? (event.days ?? []) : []);
  }, [event]);
  const close = () => {
    [create, update, remove].forEach((m) => m.reset());
    onClose();
  };

  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && close()}>
      {event !== null && (
        <DialogContent title={old ? old.title : t("planning.newEvent")} closeLabel={t("common.close")} className="max-w-md">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const start_date = String(f.get("start") ?? days[0]);
              const fields = {
                title: String(f.get("title")).trim(),
                start_date,
                end_date: String(f.get("end")) || start_date,
                start_time: allDay ? null : String(f.get("startTime")),
                end_time: allDay ? null : String(f.get("endTime")),
                color: String(f.get("color")) as CalendarEvent["color"],
                note: String(f.get("note")).trim(),
              };
              const column = toKanban && allDay ? Number(f.get("column")) : null;
              if (old) update.mutate({ id: projectId, eventId: old.id, ...fields }, { onSuccess: close });
              else if (days.length)
                // ponytail: one request per day, a failure leaves the others created; a batch route if that matters.
                Promise.all(days.map((d) => create.mutateAsync({ id: projectId, ...fields, start_date: d, end_date: d, column }))).then(close, () => {});
              else create.mutate({ id: projectId, ...fields, column }, { onSuccess: close });
            }}
          >
            {failure && <Alert tone="danger">{errorMessage(failure)}</Alert>}
            {projectId === null && <p className="-mt-2 text-sm text-muted-foreground">{t("planning.personal")}</p>}
            <fieldset disabled={!canEdit} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="event-title">{t("planning.eventTitle")}</Label>
                <Input id="event-title" name="title" required maxLength={200} autoFocus defaultValue={old?.title} autoComplete="off" />
              </div>
              {days.length > 0 ? (
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium">{t("planning.days", { count: days.length })}</span>
                  <ul className="flex flex-wrap gap-1.5">
                    {days.map((d) => {
                      const label = new Date(`${d}T00:00`).toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" });
                      return (
                        <li key={d} className="flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-sm capitalize">
                          {label}
                          {days.length > 1 && (
                            <button type="button" aria-label={t("planning.removeDay", { day: label })} onClick={() => setDays(days.filter((x) => x !== d))} className="rounded text-muted-foreground hover:text-foreground">
                              <X className="size-3.5" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="event-start">{t("planning.start")}</Label>
                  <Input id="event-start" name="start" type="date" required defaultValue={event?.start_date} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="event-end">{t("planning.end")}</Label>
                  <Input id="event-end" name="end" type="date" defaultValue={event?.end_date} />
                </div>
              </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> {t("planning.allDay")}
              </label>
              {!allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="event-start-time">{t("planning.startTime")}</Label>
                    <Input id="event-start-time" name="startTime" type="time" step={900} required defaultValue={event?.start_time ?? "09:00"} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="event-end-time">{t("planning.endTime")}</Label>
                    <Input id="event-end-time" name="endTime" type="time" step={900} required defaultValue={event?.end_time === "24:00" ? "23:59" : (event?.end_time ?? "10:00")} />
                  </div>
                </div>
              )}
              {!old && kanban && kanban.columns.length > 0 && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={toKanban && allDay} disabled={!allDay} onChange={(e) => setToKanban(e.target.checked)} /> {t("planning.toKanban")}
                  </label>
                  {toKanban && allDay && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="event-column">{t("planning.column")}</Label>
                      <Select id="event-column" name="column">
                        {kanban.columns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </>
              )}
              <div role="radiogroup" aria-label={t("planning.color")} className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input type="radio" name="color" value={c} defaultChecked={c === (old?.color ?? "blue")} aria-label={t(`board.label.${c}`)} className="peer sr-only" />
                    <span className={cn("block size-6 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-ring peer-focus-visible:ring-2 peer-focus-visible:ring-ring", LABELS[c])} />
                  </label>
                ))}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="event-note">{t("planning.note")}</Label>
                <Textarea id="event-note" name="note" rows={3} maxLength={2000} defaultValue={old?.note} />
              </div>
            </fieldset>
            {canEdit && (
              <div className="flex items-center gap-2">
                {old && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-danger"
                    onClick={async () => {
                      if ((await ask({ title: t("planning.deleteConfirm", { name: old.title }), action: t("common.delete"), danger: true })) !== null)
                        remove.mutate({ id: projectId, eventId: old.id }, { onSuccess: close });
                    }}
                  >
                    <Trash2 /> {t("common.delete")}
                  </Button>
                )}
                <Button type="button" variant="ghost" className="ml-auto" onClick={close}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" aria-busy={create.isPending || update.isPending}>
                  {t("common.save")}
                </Button>
              </div>
            )}
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
