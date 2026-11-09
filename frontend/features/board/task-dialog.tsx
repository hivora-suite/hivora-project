"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import type { BoardTask, ProjectMember } from "@/lib/api/client";
import { boardApi, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

import { AutoDescription } from "./auto-description";
import { Checklist } from "./checklist";
import { SaveState } from "./save-state";
import { TaskOptions } from "./task-options";

export function TaskDialog({ projectId, task, members, canEdit, canManage, onClose }: {
  projectId: number;
  task: BoardTask | undefined;
  members: ProjectMember[];
  canEdit: boolean;
  canManage: boolean;
  onClose: () => void;
}) {
  const { t, errorMessage } = useI18n();
  const update = useProjectMutation(boardApi.updateTask);
  const remove = useProjectMutation(boardApi.deleteTask);
  const error = update.error ?? remove.error;
  const [editingTitle, setEditingTitle] = useState(false);
  const [typing, setTyping] = useState(false);

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
    <button type="button" aria-label={t("board.editTitle", { name: task.title })} onClick={() => setEditingTitle(true)} className="group flex max-w-full items-center gap-2 text-left">
      <span className="min-w-0 break-words">{task.title}</span>
      <Pencil className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </button>
  ) : (
    task.title
  );

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={
          <span className="flex items-center gap-3">
            <span className="min-w-0 flex-1">{heading}</span>
            <SaveState typing={typing} />
          </span>
        }
        closeLabel={t("common.close")} className="max-w-xl"
        onEscapeKeyDown={(e) => editingTitle && e.preventDefault()}
      >
        {task && (
          <div key={task.id} className="grid gap-5">
            <TaskOptions projectId={projectId} task={task} members={members} canEdit={canEdit} />
            <div className="grid gap-1.5">
              <Label htmlFor="task-description">{t("projects.description")}</Label>
              <AutoDescription id="task-description" value={task.description} disabled={!canEdit} onTyping={setTyping} onSave={(description) => update.mutate({ id: projectId, taskId: task.id, description })} />
            </div>
            <Checklist projectId={projectId} task={task} canEdit={canEdit} />
            {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                className="justify-self-end text-danger"
                loading={remove.isPending}
                onClick={() => {
                  if (window.confirm(t("board.deleteConfirm", { name: task.title }))) {
                    remove.mutate({ id: projectId, taskId: task.id }, { onSuccess: onClose });
                  }
                }}
              >
                {t("common.delete")}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
