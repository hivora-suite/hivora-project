"use client";

import { Check, CircleCheck, Pencil, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";

import { useAsk } from "@/components/ask";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import type { BoardTask, ProjectMember } from "@/lib/api/client";
import { boardApi, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

import { AutoDescription } from "./auto-description";
import { Checklist } from "./checklist";
import { Comments } from "./comments";
import { SaveState } from "./save-state";
import { TaskLog } from "./task-log";
import { TaskOptions } from "./task-options";

export function TaskDialog({ projectId, task, onToggle, members, canEdit, canManage, onClose }: {
  projectId: number;
  onToggle?: () => void; // validates it, or not; absent when not allowed or unknown
  task: BoardTask | undefined;
  members: ProjectMember[];
  canEdit: boolean;
  canManage: boolean;
  onClose: () => void;
}) {
  const { t, errorMessage } = useI18n();
  const ask = useAsk();
  const update = useProjectMutation(boardApi.updateTask);
  const remove = useProjectMutation(boardApi.deleteTask);
  const error = update.error ?? remove.error;
  const [editingTitle, setEditingTitle] = useState(false);
  const [typing, setTyping] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const close = () => {
    setLogOpen(false);
    onClose();
  };

  const saveTitle = (value: string) => {
    setEditingTitle(false);
    const title = value.trim();
    if (task && title && title !== task.title) update.mutate({ id: projectId, taskId: task.id, title });
  };

  const heading = !task ? (
    ""
  ) : editingTitle ? (
    <Input
      autoFocus
      aria-label={t("board.taskTitle")}
      defaultValue={task.title}
      maxLength={200}
      autoComplete="off"
      onBlur={(e) => saveTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = task.title; // nothing to save
          e.currentTarget.blur();
        }
      }}
    />
  ) : canEdit ? (
    <button type="button" aria-label={t("board.editTitle", { name: task.title })} onClick={() => setEditingTitle(true)} className="group flex min-w-0 items-center gap-2 text-left">
      <span className="min-w-0 break-words">{task.title}</span>
      <Pencil className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </button>
  ) : (
    task.title
  );

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && close()}>
      <DialogContent
        title={
          <span className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 items-center gap-1">
              {heading}
              {task && canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("board.deleteTask")}
                  loading={remove.isPending}
                  className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    if ((await ask({ title: t("board.deleteConfirm", { name: task.title }), action: t("common.delete"), danger: true })) !== null) {
                      remove.mutate({ id: projectId, taskId: task.id }, { onSuccess: close });
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
              {task?.done && (
                <span className="ml-2 flex shrink-0 items-center gap-1 text-sm font-medium text-ok">
                  <CircleCheck className="size-4" /> {t("board.finished")}
                </span>
              )}
              {task && onToggle && (
                <Button type="button" variant="outline" size="sm" className="ml-2 shrink-0" onClick={onToggle}>
                  {task.done ? <Undo2 /> : <Check />} {t(task.done ? "board.reopenTask" : "board.completeTask")}
                </Button>
              )}
            </span>
            <SaveState typing={typing} />
          </span>
        }
        closeLabel={t("common.close")} className="max-w-5xl"
        onEscapeKeyDown={(e) => editingTitle && e.preventDefault()}
      >
        {task && (
          <div key={task.id} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid min-w-0 content-start gap-5">
            <TaskOptions projectId={projectId} task={task} members={members} canEdit={canEdit} logOpen={logOpen} onToggleLog={() => setLogOpen(!logOpen)} />
            <div className="grid gap-1.5">
              <Label htmlFor="task-description">{t("projects.description")}</Label>
              <AutoDescription id="task-description" value={task.description} disabled={!canEdit} onTyping={setTyping} onSave={(description) => update.mutate({ id: projectId, taskId: task.id, description })} />
            </div>
            <Checklist projectId={projectId} task={task} canEdit={canEdit} />
            {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
            </div>
            {/* The chat, or the log in its place. */}
            <aside className="flex min-h-0 flex-col gap-3 md:sticky md:top-0 md:h-[70vh] md:self-start md:border-l md:pl-6">
              {logOpen ? (
                <div key="log" className="animate-enter grid min-h-0 content-start gap-3 overflow-y-auto">
                  <h3 className="text-sm font-semibold">{t("board.log")}</h3>
                  <TaskLog projectId={projectId} taskId={task.id} />
                </div>
              ) : (
                <Comments projectId={projectId} taskId={task.id} canEdit={canEdit} canManage={canManage} />
              )}
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
