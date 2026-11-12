"use client";

import { Pencil, SendHorizontal, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useSession } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { commentApi, useComments, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Enter sends, Shift + Enter starts a new line. */
const sendOnEnter = (e: KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  }
};

/** Card comments as a chat: oldest first, mine on the right, input at the bottom. */
export function Comments({ projectId, taskId, canEdit, canManage }: { projectId: number; taskId: number; canEdit: boolean; canManage: boolean }) {
  const { t, lang, errorMessage } = useI18n();
  const { me } = useSession();
  const { data } = useComments(projectId, taskId);
  const comments = [...(data ?? [])].reverse(); // the API sends the newest first
  const [editing, setEditing] = useState<number | null>(null);
  const add = useProjectMutation(commentApi.add);
  const edit = useProjectMutation(commentApi.edit);
  const remove = useProjectMutation(commentApi.remove);
  const error = add.error ?? edit.error ?? remove.error;
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [comments.length]);

  return (
    <section className="flex h-96 min-h-0 flex-col gap-3 md:h-auto md:flex-1">
      <h3 className="text-sm font-semibold">{t("board.comments")}</h3>
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1">
        {comments.map((c) => {
          const mine = c.author_id === me.id;
          return (
            <article key={c.id} className={cn("group grid max-w-[85%] gap-1 text-sm", mine ? "justify-items-end justify-self-end" : "justify-items-start")}>
              <header className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.author ?? t("board.deletedAccount")}</span>
                <time>{new Date(c.created_at).toLocaleString(lang, { dateStyle: "short", timeStyle: "short" })}</time>
                {c.edited && <span>{t("board.edited")}</span>}
              </header>
              {editing === c.id ? (
                <form
                  className="grid w-full gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    edit.mutate({ id: projectId, commentId: c.id, body: String(new FormData(e.currentTarget).get("body")) }, { onSuccess: () => setEditing(null) });
                  }}
                >
                  <Textarea name="body" required autoFocus maxLength={5000} rows={2} defaultValue={c.body} aria-label={t("board.editComment")} onKeyDown={sendOnEnter} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      {t("common.cancel")}
                    </Button>
                    <Button type="submit" size="sm" loading={edit.isPending} disabled={edit.isPending}>
                      {t("common.save")}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className={cn("flex items-center gap-1", mine && "flex-row-reverse")}>
                  <p className={cn("whitespace-pre-wrap break-words rounded-2xl px-3 py-2", mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>{c.body}</p>
                  {/* Shown on hover, and to the keyboard on focus. */}
                  <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {canEdit && mine && (
                      <Button variant="ghost" size="icon" aria-label={t("board.editComment")} onClick={() => setEditing(c.id)}>
                        <Pencil />
                      </Button>
                    )}
                    {canEdit && (canManage || mine) && (
                      <Button variant="ghost" size="icon" aria-label={t("board.deleteComment")} onClick={() => remove.mutate({ id: projectId, commentId: c.id })}>
                        <Trash2 />
                      </Button>
                    )}
                  </span>
                </div>
              )}
            </article>
          );
        })}
        <div ref={end} />
      </div>
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
      {canEdit && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            add.mutate({ id: projectId, taskId, body: String(new FormData(form).get("body")) }, { onSuccess: () => form.reset() });
          }}
        >
          <Textarea name="body" required maxLength={5000} rows={1} className="max-h-32 min-h-9 resize-none field-sizing-content" aria-label={t("board.addComment")} placeholder={t("board.addComment")} onKeyDown={sendOnEnter} />
          <Button type="submit" size="icon" aria-label={t("board.send")} loading={add.isPending} disabled={add.isPending}>
            <SendHorizontal />
          </Button>
        </form>
      )}
    </section>
  );
}
