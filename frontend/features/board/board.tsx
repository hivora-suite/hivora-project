"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { Fragment, useRef, useState, type DragEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { BoardColumn, BoardTask, Project, ProjectMember } from "@/lib/api/client";
import { boardApi, useBoard, useMembers, useMoveTask, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

import { TaskCard } from "./task-card";
import { TaskDialog } from "./task-dialog";
import { useFlip } from "./use-flip";

type Drop = { columnId: number; index: number };

function Column({ projectId, column, index, columnCount, tasks, members, canEdit, canManage, onOpen, onStep, dragId, over, setDragId, setOver, onDrop }: {
  projectId: number;
  column: BoardColumn;
  index: number;
  columnCount: number;
  tasks: BoardTask[];
  members: ProjectMember[];
  canEdit: boolean;
  canManage: boolean;
  onOpen: (taskId: number) => void;
  onStep: (task: BoardTask, key: string) => void;
  dragId: number | null;
  over: Drop | null;
  setDragId: (id: number | null) => void;
  setOver: (drop: Drop | null) => void;
  onDrop: (drop: Drop) => void;
}) {
  const { t, errorMessage } = useI18n();
  const add = useProjectMutation(boardApi.createTask);
  const rename = useProjectMutation(boardApi.updateColumn);
  const remove = useProjectMutation(boardApi.deleteColumn);
  const error = add.error ?? rename.error ?? remove.error;
  // Where the dragged card would land: among the other cards, by the pointer's height.
  const dropIndex = (e: DragEvent<HTMLElement>) =>
    [...e.currentTarget.querySelectorAll<HTMLElement>("[data-task]")]
      .filter((card) => Number(card.dataset.task) !== dragId)
      .filter((card) => {
        const box = card.getBoundingClientRect();
        return box.top + box.height / 2 < e.clientY;
      }).length;
  const others = tasks.filter((task) => task.id !== dragId);
  const line = over?.columnId === column.id ? (over.index < others.length ? others[over.index].id : "end") : null;
  const dropLine = <div aria-hidden className="h-0.5 rounded-full bg-primary" />;

  return (
    <section
      aria-label={column.name}
      className="surface flex w-72 shrink-0 flex-col gap-3 rounded-xl p-3"
      onDragOver={(e) => {
        if (dragId === null) return;
        e.preventDefault();
        setOver({ columnId: column.id, index: dropIndex(e) });
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragId !== null) onDrop({ columnId: column.id, index: dropIndex(e) });
      }}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 break-words text-sm font-semibold">
          {column.name} <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{tasks.length}</span>
        </h2>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("board.columnActions", { name: column.name })}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onSelect={() => {
                  const name = window.prompt(t("board.columnName"), column.name)?.trim();
                  if (name) rename.mutate({ id: projectId, columnId: column.id, name });
                }}
              >
                {t("board.renameColumn")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === 0} onSelect={() => rename.mutate({ id: projectId, columnId: column.id, position: index - 1 })}>
                {t("board.moveLeft")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === columnCount - 1} onSelect={() => rename.mutate({ id: projectId, columnId: column.id, position: index + 1 })}>
                {t("board.moveRight")}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-danger" onSelect={() => remove.mutate({ id: projectId, columnId: column.id })}>
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      {tasks.map((task) => (
        <Fragment key={task.id}>
          {line === task.id && dropLine}
          <TaskCard
            task={task}
            members={members}
            draggable={canEdit}
            dragging={task.id === dragId}
            onOpen={() => onOpen(task.id)}
            onStep={(key) => onStep(task, key)}
            onDragStart={() => setDragId(task.id)}
            onDragEnd={() => {
              setDragId(null);
              setOver(null);
            }}
          />
        </Fragment>
      ))}
      {line === "end" && dropLine}
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const title = String(new FormData(form).get("title"));
            add.mutate({ id: projectId, title, column_id: column.id }, { onSuccess: () => form.reset() });
          }}
        >
          <Input name="title" required maxLength={200} autoComplete="off" placeholder={t("board.addTask")} aria-label={t("board.addTaskIn", { name: column.name })} />
        </form>
      )}
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
    </section>
  );
}

export function Board({ project }: { project: Project }) {
  const { t, errorMessage } = useI18n();
  const { data: board, error } = useBoard(project.id);
  const { data: members = [] } = useMembers(project.id);
  const [openId, setOpenId] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<Drop | null>(null);
  const addColumn = useProjectMutation(boardApi.createColumn);
  const move = useMoveTask(project.id);
  const scroller = useRef<HTMLDivElement>(null);
  useFlip(scroller, [board, over]);
  const canEdit = project.role !== "viewer" && !project.archived;
  const canManage = project.role === "manager" && !project.archived;
  const failure = error ?? addColumn.error ?? move.error;
  const inColumn = (columnId: number) => board?.tasks.filter((task) => task.column_id === columnId) ?? [];
  const opened = board?.tasks.find((task) => task.id === openId);

  // The keyboard alternative to dragging: Alt + arrows on a card's button.
  const step = (task: BoardTask, key: string) => {
    const columns = board?.columns ?? [];
    const index = columns.findIndex((c) => c.id === task.column_id);
    const across = key === "ArrowLeft" ? columns[index - 1] : key === "ArrowRight" ? columns[index + 1] : undefined;
    const here = inColumn(task.column_id).indexOf(task);
    const position = across ? inColumn(across.id).length : key === "ArrowUp" ? here - 1 : key === "ArrowDown" ? here + 1 : -1;
    if (position < 0 || (!across && !["ArrowUp", "ArrowDown"].includes(key))) return;
    move.mutate({ taskId: task.id, column_id: across?.id ?? task.column_id, position });
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-task="${task.id}"] button`)?.focus());
  };

  return (
    <div className="mb-6 grid gap-3">
      {failure && <Alert tone="danger">{errorMessage(failure)}</Alert>}
      <div ref={scroller} className="flex items-start gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {board?.columns.map((column, index) => (
          <Column
            key={column.id}
            projectId={project.id}
            column={column}
            index={index}
            columnCount={board.columns.length}
            tasks={inColumn(column.id)}
            dragId={dragId}
            over={over}
            setDragId={setDragId}
            setOver={setOver}
            onDrop={(drop) => {
              if (dragId !== null) move.mutate({ taskId: dragId, column_id: drop.columnId, position: drop.index });
              setDragId(null);
              setOver(null);
            }}
            members={members}
            canEdit={canEdit}
            canManage={canManage}
            onOpen={setOpenId}
            onStep={step}
          />
        ))}
        {canManage && (
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => {
              const name = window.prompt(t("board.columnName"))?.trim();
              if (name) addColumn.mutate({ id: project.id, name });
            }}
          >
            <Plus /> {t("board.addColumn")}
          </Button>
        )}
      </div>
      <TaskDialog
        projectId={project.id}
        task={opened}
        members={members}
        canEdit={canEdit}
        canManage={canManage}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
