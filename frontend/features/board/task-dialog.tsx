"use client";

import type { FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import type { BoardTask, ProjectMember } from "@/lib/api/client";
import { boardApi, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

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

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!task) return;
    const f = new FormData(e.currentTarget);
    const assignee = String(f.get("assignee"));
    update.mutate(
      {
        id: projectId,
        taskId: task.id,
        title: String(f.get("title")),
        description: String(f.get("description")),
        assignee_id: assignee ? Number(assignee) : null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={task?.title ?? ""} closeLabel={t("common.close")}>
        <form key={task?.id} className="grid gap-4" onSubmit={submit}>
          <fieldset disabled={!canEdit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="task-title">{t("board.taskTitle")}</Label>
              <Input id="task-title" name="title" defaultValue={task?.title} required maxLength={200} autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="task-description">{t("projects.description")}</Label>
              <Input id="task-description" name="description" defaultValue={task?.description} maxLength={5000} autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="task-assignee">{t("board.assignee")}</Label>
              <Select id="task-assignee" name="assignee" defaultValue={task?.assignee_id ?? ""}>
                <option value="">{t("board.unassigned")}</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.username}
                  </option>
                ))}
              </Select>
            </div>
          </fieldset>
          {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
          {canEdit && (
            <div className="flex justify-between gap-2">
              <Button type="submit" loading={update.isPending} disabled={update.isPending}>
                {t("common.save")}
              </Button>
              {canManage && task && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-danger"
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
