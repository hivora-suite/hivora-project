"use client";

import { ChevronRight } from "lucide-react";

import type { BoardTask, TaskEvent } from "@/lib/api/client";
import { useTaskHistory } from "@/lib/api/hooks";
import { useI18n, type MessageKey } from "@/lib/i18n";

function Summary({ event, expandable }: { event: TaskEvent; expandable: boolean }) {
  const { t, lang } = useI18n();
  return (
    <span className="flex items-start gap-1">
      <span className="grid min-w-0 flex-1">
        <span>
          <span className="font-medium">{event.author ?? t("board.deletedAccount")}</span> {t(`board.log.${event.action}` as MessageKey, { detail: event.detail })}
        </span>
        <time className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" })}</time>
      </span>
      {expandable && <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />}
    </span>
  );
}

/** A card's changes, newest first; a click on a line shows what it changed. */
export function TaskLog({ projectId, taskId }: { projectId: number; taskId: number }) {
  const { t } = useI18n();
  const { data: events } = useTaskHistory(projectId, taskId);
  const shown = (event: TaskEvent, value: string) =>
    event.action === "labels" ? value.split(", ").filter(Boolean).map((label) => t(`board.label.${label as BoardTask["labels"][number]}`)).join(", ") : value;

  const value = (event: TaskEvent, label: MessageKey, text: string) => (
    <div>
      <div className="font-medium text-muted-foreground">{t(label)}</div>
      <div className="whitespace-pre-wrap break-words">{shown(event, text) || t("board.log.empty")}</div>
    </div>
  );

  return (
    <ul className="grid max-h-[70vh] content-start gap-3 overflow-y-auto text-sm">
      {events?.map((event) => (
        <li key={event.id}>
          {event.old_value || event.new_value ? (
            <details className="group">
              <summary className="cursor-pointer list-none rounded-sm [&::-webkit-details-marker]:hidden">
                <Summary event={event} expandable />
              </summary>
              <div className="animate-enter mt-1.5 grid gap-2 rounded-md bg-muted p-2 text-xs">
                {value(event, "board.log.before", event.old_value)}
                {value(event, "board.log.after", event.new_value)}
              </div>
            </details>
          ) : (
            <Summary event={event} expandable={false} />
          )}
        </li>
      ))}
    </ul>
  );
}
