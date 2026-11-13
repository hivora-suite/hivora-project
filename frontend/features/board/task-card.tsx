"use client";

import { Calendar, Check, CheckSquare, CircleCheck, Maximize2 } from "lucide-react";
import { useState } from "react";

import type { BoardTask, ProjectMember } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { LABELS } from "./labels";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

export function TaskCard({ task, hint, onToggle, members, draggable, dragging, onOpen, onStep, onDragStart, onDragEnd }: {
  task: BoardTask;
  hint?: string; // its project, when cards of several projects mix (My kanban)
  onToggle?: () => void; // validates it, or not; absent when not allowed
  members: ProjectMember[];
  draggable: boolean;
  dragging: boolean;
  onOpen: () => void;
  onStep: (key: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { t, lang } = useI18n();
  const done = task.checklist.filter((item) => item.done).length;
  const assignees = members.filter((m) => task.assignee_ids.includes(m.user_id));
  // Validated from here: a green pulse and a pop, never on cards loaded already validated.
  const [cheered, setCheered] = useState(false);
  return (
    <div
      data-task={task.id}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(task.id)); // Firefox needs data
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        "group grid cursor-pointer gap-2 rounded-md border bg-card p-2.5 text-sm shadow-sm transition-[border-color,box-shadow,opacity] duration-200 hover:border-primary hover:shadow-md",
        dragging && "opacity-40",
        cheered && task.done && "animate-done",
      )}
    >
      {hint && <span className="-mb-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{hint}</span>}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span key={label} className={cn("h-1.5 w-8 rounded-full", LABELS[label])} />
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 break-words font-medium">
          {/* The strike is drawn left to right. */}
          <span className={cn("bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[position:0_55%] bg-no-repeat box-decoration-clone transition-[background-size,color] duration-500", task.done && "bg-[length:100%_1px] text-muted-foreground")}>{task.title}</span>
        </span>
        {onToggle || task.done ? (
          <button
            type="button"
            disabled={!onToggle}
            aria-label={t(task.done ? "board.reopen" : "board.complete", { name: task.title })}
            title={t(task.done ? "board.reopen" : "board.complete", { name: task.title })}
            aria-pressed={task.done}
            onClick={(e) => {
              e.stopPropagation();
              setCheered(!task.done);
              onToggle?.();
            }}
            className={cn(
              "shrink-0 rounded p-0.5 transition-[opacity,color,background-color] enabled:hover:bg-muted",
              task.done ? "text-ok" : "text-muted-foreground opacity-0 hover:text-ok focus-visible:opacity-100 group-hover:opacity-100",
            )}
          >
            {task.done ? <CircleCheck className={cn("size-4", cheered && "animate-pop")} /> : <Check className="size-3.5" />}
          </button>
        ) : null}
        {/* Its click reaches the card, which opens: one behaviour, and a keyboard target. */}
        <button
          type="button"
          aria-label={t("board.open", { name: task.title })}
          title={t("board.open", { name: task.title })}
          aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
          onKeyDown={(e) => {
            if (draggable && e.altKey && e.key.startsWith("Arrow")) {
              e.preventDefault();
              onStep(e.key);
            }
          }}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>
      {(task.due_date || task.checklist.length > 0 || assignees.length > 0) && (
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
          {task.due_date && (
            <span className={cn("flex items-center gap-1", task.due_date < today() && "font-medium text-danger")}>
              <Calendar className="size-3.5" />
              {new Date(`${task.due_date}T00:00`).toLocaleDateString(lang, { day: "numeric", month: "short" })}
            </span>
          )}
          {task.checklist.length > 0 && (
            <span className={cn("flex items-center gap-1", done === task.checklist.length && "text-ok")}>
              <CheckSquare className="size-3.5" /> {done}/{task.checklist.length}
            </span>
          )}
          <span className="ml-auto flex -space-x-1">
            {assignees.map((m) => (
              <span key={m.user_id} title={m.username} className="grid size-5 place-items-center rounded-full border bg-muted text-[10px] font-semibold uppercase text-foreground">
                {m.username[0]}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
