"use client";

import { Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { BoardTask } from "@/lib/api/client";
import { boardApi, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

export function Checklist({ projectId, task, canEdit }: { projectId: number; task: BoardTask; canEdit: boolean }) {
  const { t, errorMessage } = useI18n();
  const add = useProjectMutation(boardApi.addItem);
  const update = useProjectMutation(boardApi.updateItem);
  const remove = useProjectMutation(boardApi.deleteItem);
  const error = add.error ?? update.error ?? remove.error;
  const done = task.checklist.filter((item) => item.done).length;
  const percent = task.checklist.length ? Math.round((done / task.checklist.length) * 100) : 0;

  return (
    <section className="grid gap-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">{t("board.checklist")}</h3>
        <span className="font-mono text-xs text-muted-foreground">{percent}%</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
        </div>
      </div>
      {task.checklist.map((item) => (
        <div key={item.id} className="flex items-center gap-2 text-sm">
          <input
            id={`item-${item.id}`}
            type="checkbox"
            className="peer size-4 accent-primary"
            defaultChecked={item.done}
            disabled={!canEdit}
            onChange={(e) => update.mutate({ id: projectId, itemId: item.id, done: e.target.checked })}
          />
          <Label htmlFor={`item-${item.id}`} className="flex-1 font-normal peer-checked:text-muted-foreground peer-checked:line-through">
            {item.title}
          </Label>
          {canEdit && (
            <Button variant="ghost" size="icon" aria-label={t("board.removeItem", { name: item.title })} onClick={() => remove.mutate({ id: projectId, itemId: item.id })}>
              <Trash2 />
            </Button>
          )}
        </div>
      ))}
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            add.mutate({ id: projectId, taskId: task.id, title: String(new FormData(form).get("title")) }, { onSuccess: () => form.reset() });
          }}
        >
          <Input name="title" required maxLength={200} autoComplete="off" placeholder={t("board.addItem")} aria-label={t("board.addItem")} />
        </form>
      )}
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
    </section>
  );
}
