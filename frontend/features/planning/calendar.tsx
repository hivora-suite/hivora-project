"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LABELS } from "@/features/board/labels";
import { TaskDialog } from "@/features/board/task-dialog";
import type { BoardTask, Project } from "@/lib/api/client";
import { useBoard, useMembers } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const iso = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

/** The days shown for a month: whole weeks, Monday first. */
export function monthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => new Date(year, month, 1 - offset + i));
}

/** A card shows on every day from its start to its due date, or on its only date. */
export function onDay(task: BoardTask, day: string) {
  const from = task.start_date ?? task.due_date;
  const to = task.due_date ?? task.start_date;
  return !!from && !!to && from <= day && day <= to;
}

export function Calendar({ project }: { project: Project }) {
  const { t, lang, errorMessage } = useI18n();
  const { data: board, error } = useBoard(project.id);
  const { data: members = [] } = useMembers(project.id);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [openId, setOpenId] = useState<number | null>(null);
  const today = iso(new Date());
  const tasks = board?.tasks.filter((task) => task.start_date || task.due_date) ?? [];
  const days = monthDays(month.getFullYear(), month.getMonth());
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const canEdit = project.role !== "viewer" && !project.archived;
  const canManage = project.role === "manager" && !project.archived;

  return (
    <div className="mb-6 grid gap-3">
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label={t("planning.previous")} title={t("planning.previous")} onClick={() => shift(-1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
          {t("planning.today")}
        </Button>
        <Button variant="outline" size="icon" aria-label={t("planning.next")} title={t("planning.next")} onClick={() => shift(1)}>
          <ChevronRight />
        </Button>
        <h2 aria-live="polite" className="ml-2 text-lg font-semibold capitalize">
          {month.toLocaleDateString(lang, { month: "long", year: "numeric" })}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 overflow-hidden rounded-md border bg-border gap-px">
          {days.slice(0, 7).map((d) => (
            <div key={d.getDay()} aria-hidden className="bg-card px-2 py-1.5 text-xs font-medium capitalize text-muted-foreground">
              {d.toLocaleDateString(lang, { weekday: "short" })}
            </div>
          ))}
          {days.map((d) => {
            const day = iso(d);
            return (
              <div
                key={day}
                role="group"
                aria-label={d.toLocaleDateString(lang, { dateStyle: "full" })}
                className={cn("flex min-h-24 flex-col gap-1 bg-card p-1.5", d.getMonth() !== month.getMonth() && "bg-muted/40 text-muted-foreground")}
              >
                <span className={cn("grid size-6 place-items-center rounded-full text-xs", day === today && "bg-primary font-semibold text-primary-foreground")}>
                  {d.getDate()}
                </span>
                {tasks.filter((task) => onDay(task, day)).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setOpenId(task.id)}
                    className={cn(
                      "flex items-center gap-1.5 truncate rounded border bg-background px-1.5 py-0.5 text-left text-xs transition-colors hover:border-primary",
                      task.due_date && task.due_date < today && "font-medium text-danger",
                    )}
                  >
                    {task.labels[0] && <span aria-hidden className={cn("size-2 shrink-0 rounded-full", LABELS[task.labels[0]])} />}
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <TaskDialog
        projectId={project.id}
        task={board?.tasks.find((task) => task.id === openId)}
        members={members}
        canEdit={canEdit}
        canManage={canManage}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
