"use client";

import { Calendar, History, Tag, Users, X, type LucideIcon } from "lucide-react";
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
export function TaskOptions({ projectId, task, members, canEdit, logOpen, onToggleLog }: {
  projectId: number;
  task: BoardTask;
  members: ProjectMember[];
  canEdit: boolean;
  logOpen: boolean;
  onToggleLog: () => void;
}) {
  const { t, lang, errorMessage } = useI18n();
  const [panel, setPanel] = useState<Panel | null>(null);
  const update = useProjectMutation(boardApi.updateTask);
  const save = (fields: Omit<Parameters<typeof boardApi.updateTask>[0], "id" | "taskId">) => update.mutate({ id: projectId, taskId: task.id, ...fields });
  const saveMembers = (form: HTMLFormElement) => save({ assignee_ids: new FormData(form).getAll("assignee").map(Number) });
  const saveLabels = (form: HTMLFormElement) => save({ labels: new FormData(form).getAll("label").map(String) as LabelName[] });
  const saveDates = (form: HTMLFormElement) => {
    const f = new FormData(form);
    save({ start_date: String(f.get("start")) || null, due_date: String(f.get("due")) || null });
  };
  /** Empties the form's inputs (or only `name`), then saves it. */
  const clear = (label: string, saveForm: (form: HTMLFormElement) => void, name?: string) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={(e) => {
        const form = e.currentTarget.form!;
        for (const el of form.querySelectorAll<HTMLInputElement>(name ? `input[name="${name}"]` : "input")) {
          if (el.type === "checkbox") el.checked = false;
          else el.value = "";
        }
        saveForm(form);
      }}
    >
      <X />
    </Button>
  );
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
        <Button type="button" variant="outline" size="sm" aria-expanded={logOpen} onClick={onToggleLog}>
          <History /> {t("board.log")}
        </Button>
      </div>
      <fieldset disabled={!canEdit}>
        {/* Kept mounted when folded: each form holds the state of its inputs. */}
        <Collapse open={panel === "members"}>
          <form className="flex items-start gap-2 rounded-md border p-3" onChange={(e) => saveMembers(e.currentTarget)}>
          <div className="grid flex-1 gap-1.5">
          {members.map((m) => (
            <label key={m.user_id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="assignee" value={m.user_id} defaultChecked={task.assignee_ids.includes(m.user_id)} className="size-4 accent-primary" />
              {m.username}
            </label>
          ))}
          </div>
          {clear(t("board.clearAll"), saveMembers)}
        </form>
        </Collapse>
        <Collapse open={panel === "labels"}>
          <form className="flex items-start justify-between gap-2 rounded-md border p-3" onChange={(e) => saveLabels(e.currentTarget)}>
          <div className="grid w-fit grid-cols-6 gap-2">
            {Object.entries(LABELS).map(([name, color]) => (
              <label key={name} className="cursor-pointer">
                <input type="checkbox" name="label" value={name} defaultChecked={task.labels.includes(name as LabelName)} aria-label={t(`board.label.${name as LabelName}`)} className="peer sr-only" />
                <span className={cn("block h-6 w-9 rounded-md opacity-40 ring-offset-2 ring-offset-card transition peer-checked:opacity-100 peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring", color)} />
              </label>
            ))}
          </div>
          {clear(t("board.clearAll"), saveLabels)}
        </form>
        </Collapse>
        <Collapse open={panel === "dates"}>
        <form className="grid grid-cols-2 gap-3 rounded-md border p-3" onChange={(e) => saveDates(e.currentTarget)}>
          {(["start", "due"] as const).map((name) => (
            <div key={name} className="grid gap-1.5">
              <Label htmlFor={`task-${name}`}>{t(`board.${name}`)}</Label>
              <div className="flex gap-1">
                <Input id={`task-${name}`} name={name} type="date" defaultValue={task[name === "start" ? "start_date" : "due_date"] ?? ""} />
                {clear(t("board.clearDate"), saveDates, name)}
              </div>
            </div>
          ))}
        </form>
        </Collapse>
      </fieldset>
      {update.error && <Alert tone="danger">{errorMessage(update.error)}</Alert>}
    </div>
  );
}
