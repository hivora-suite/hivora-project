"use client";

import { Calendar, Tag, Users, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { Input, Label } from "@/components/ui/input";
import type { BoardTask, ProjectMember } from "@/lib/api/client";
import { boardApi, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { LABELS } from "./labels";

type Panel = "members" | "labels" | "dates";
type LabelName = BoardTask["labels"][number];

/** What changes rarely, behind small buttons; each change is saved at once. */
export function TaskOptions({ projectId, task, members, canEdit }: {
  projectId: number;
  task: BoardTask;
  members: ProjectMember[];
  canEdit: boolean;
}) {
  const { t, lang, errorMessage } = useI18n();
  const [panel, setPanel] = useState<Panel | null>(null);
  const update = useProjectMutation(boardApi.updateTask);
  const save = (fields: Omit<Parameters<typeof boardApi.updateTask>[0], "id" | "taskId">) => update.mutate({ id: projectId, taskId: task.id, ...fields });
  const day = (date: string) => new Date(`${date}T00:00`).toLocaleDateString(lang, { day: "numeric", month: "short" });
  const dates = [task.start_date, task.due_date].filter((d): d is string => !!d).map(day).join(" → ");

  const toggle = (name: Panel, icon: LucideIcon, label: string, summary: ReactNode) => {
    const Icon = icon;
    return (
      <Button type="button" variant="outline" size="sm" aria-expanded={panel === name} onClick={() => setPanel(panel === name ? null : name)}>
        <Icon /> {label} {summary}
      </Button>
    );
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {toggle("members", Users, t("board.assignees"), task.assignee_ids.length > 0 && <span className="font-mono text-xs">{task.assignee_ids.length}</span>)}
        {toggle("labels", Tag, t("board.labels"), task.labels.map((label) => <span key={label} className={cn("size-2.5 rounded-full", LABELS[label])} />))}
        {toggle("dates", Calendar, t("board.dates"), dates && <span className="text-xs text-muted-foreground">{dates}</span>)}
      </div>
      <fieldset disabled={!canEdit}>
        {/* Kept mounted when folded: each form holds the state of its inputs. */}
        <Collapse open={panel === "members"}>
          <form className="grid gap-1.5 rounded-md border p-3" onChange={(e) => save({ assignee_ids: new FormData(e.currentTarget).getAll("assignee").map(Number) })}>
          {members.map((m) => (
            <label key={m.user_id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="assignee" value={m.user_id} defaultChecked={task.assignee_ids.includes(m.user_id)} className="size-4 accent-primary" />
              {m.username}
            </label>
          ))}
        </form>
        </Collapse>
        <Collapse open={panel === "labels"}>
          <form className="rounded-md border p-3" onChange={(e) => save({ labels: new FormData(e.currentTarget).getAll("label").map(String) as LabelName[] })}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(LABELS).map(([name, color]) => (
              <label key={name} className="cursor-pointer">
                <input type="checkbox" name="label" value={name} defaultChecked={task.labels.includes(name as LabelName)} aria-label={t(`board.label.${name as LabelName}`)} className="peer sr-only" />
                <span className={cn("block h-6 w-9 rounded-md opacity-40 ring-offset-2 ring-offset-card transition peer-checked:opacity-100 peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring", color)} />
              </label>
            ))}
          </div>
        </form>
        </Collapse>
        <Collapse open={panel === "dates"}>
        <form
          className="grid grid-cols-2 gap-3 rounded-md border p-3"
          onChange={(e) => {
            const f = new FormData(e.currentTarget);
            save({ start_date: String(f.get("start")) || null, due_date: String(f.get("due")) || null });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="task-start">{t("board.start")}</Label>
            <Input id="task-start" name="start" type="date" defaultValue={task.start_date ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-due">{t("board.due")}</Label>
            <Input id="task-due" name="due" type="date" defaultValue={task.due_date ?? ""} />
          </div>
        </form>
        </Collapse>
      </fieldset>
      {update.error && <Alert tone="danger">{errorMessage(update.error)}</Alert>}
    </div>
  );
}
