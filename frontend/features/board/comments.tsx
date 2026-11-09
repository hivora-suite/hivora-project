"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { commentApi, useComments, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

export function Comments({ projectId, taskId, canEdit, canManage }: { projectId: number; taskId: number; canEdit: boolean; canManage: boolean }) {
  const { t, lang, errorMessage } = useI18n();
  const { me } = useSession();
  const { data: comments } = useComments(projectId, taskId);
  const [editing, setEditing] = useState<number | null>(null);
  const add = useProjectMutation(commentApi.add);
  const edit = useProjectMutation(commentApi.edit);
  const remove = useProjectMutation(commentApi.remove);
  const error = add.error ?? edit.error ?? remove.error;

  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-semibold">{t("board.comments")}</h3>
      {canEdit && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            add.mutate({ id: projectId, taskId, body: String(new FormData(form).get("body")) }, { onSuccess: () => form.reset() });
          }}
        >
          <Textarea name="body" required maxLength={5000} rows={2} aria-label={t("board.addComment")} placeholder={t("board.addComment")} />
          <Button type="submit" size="sm" className="justify-self-start" loading={add.isPending} disabled={add.isPending}>
            {t("board.send")}
          </Button>
        </form>
      )}
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
      {comments?.map((c) => (
        <article key={c.id} className="grid gap-1 text-sm">
          <header className="flex items-center gap-2">
            <span className="font-medium">{c.author ?? t("board.deletedAccount")}</span>
            <time className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" })}</time>
            {c.edited && <span className="text-xs text-muted-foreground">{t("board.edited")}</span>}
            <span className="ml-auto flex">
              {canEdit && c.author_id === me.id && (
                <Button variant="ghost" size="icon" aria-label={t("board.editComment")} onClick={() => setEditing(c.id)}>
                  <Pencil />
                </Button>
              )}
              {canEdit && (canManage || c.author_id === me.id) && (
                <Button variant="ghost" size="icon" aria-label={t("board.deleteComment")} onClick={() => remove.mutate({ id: projectId, commentId: c.id })}>
                  <Trash2 />
                </Button>
              )}
            </span>
          </header>
          {editing === c.id ? (
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                edit.mutate({ id: projectId, commentId: c.id, body: String(new FormData(e.currentTarget).get("body")) }, { onSuccess: () => setEditing(null) });
              }}
            >
              <Textarea name="body" required autoFocus maxLength={5000} rows={2} defaultValue={c.body} aria-label={t("board.editComment")} />
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={edit.isPending} disabled={edit.isPending}>
                  {t("common.save")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  {t("board.cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <p className="whitespace-pre-wrap break-words">{c.body}</p>
          )}
        </article>
      ))}
    </section>
  );
}
