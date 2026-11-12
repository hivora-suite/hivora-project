"use client";

import { CircleCheck, MoreHorizontal, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Fragment, useRef, useState, type DragEvent, type ReactNode } from "react";

import { useAsk } from "@/components/ask";
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
import { boardApi, CARD_QUEUE, useBoard, useMembers, useMoveTask, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { TaskCard } from "./task-card";
import { TaskDialog } from "./task-dialog";
import { useFlip } from "./use-flip";

/** A card in a column: `hint` names its project when the board mixes several (My kanban). */
export type Card = { task: BoardTask; hint?: string; members: ProjectMember[]; draggable: boolean; toggle?: () => void };

/** The dragging shared by a board's columns: the card held, and where it would land. */
export type Dnd = {
  dragId: number | null;
  setDragId: (id: number | null) => void;
  over: { key: string; index: number } | null;
  setOver: (over: { key: string; index: number } | null) => void;
};

export function useDnd(): Dnd {
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<Dnd["over"]>(null);
  return { dragId, setDragId, over, setOver };
}

/** One column: its cards, a drop line where the held card would land, and a large drop area. */
export function Column({ id, label, done, cards, dnd, accepts = () => true, onDrop, onOpen, onStep, menu, footer, empty }: {
  id: string;
  label: string;
  done?: boolean; // the board's Done column
  cards: Card[];
  dnd: Dnd;
  accepts?: (taskId: number) => boolean;
  onDrop: (taskId: number, index: number) => void;
  onOpen: (taskId: number) => void;
  onStep: (task: BoardTask, key: string) => void;
  menu?: ReactNode;
  footer?: ReactNode;
  empty?: ReactNode;
}) {
  const { dragId, setDragId, over, setOver } = dnd;
  const open = dragId !== null && accepts(dragId);
  // Where the held card would land: among the other cards, by the pointer's height.
  const dropIndex = (e: DragEvent<HTMLElement>) =>
    [...e.currentTarget.querySelectorAll<HTMLElement>("[data-task]")]
      .filter((card) => Number(card.dataset.task) !== dragId)
      .filter((card) => {
        const box = card.getBoundingClientRect();
        return box.top + box.height / 2 < e.clientY;
      }).length;
  const others = cards.filter((c) => c.task.id !== dragId);
  const at = over?.key === id ? over.index : null;
  const line = at === null ? null : at < others.length ? others[at].task.id : "end";
  const dropLine = <div aria-hidden className="h-0.5 shrink-0 rounded-full bg-primary" />;
  const end = () => {
    setDragId(null);
    setOver(null);
  };

  return (
    <section
      aria-label={label}
      className={cn("surface flex w-72 shrink-0 flex-col gap-3 rounded-xl p-3 transition-opacity", dragId !== null && !open && "opacity-50")}
      onDragOver={(e) => {
        if (!open) return;
        e.preventDefault();
        const index = dropIndex(e);
        if (at !== index) setOver({ key: id, index });
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && over?.key === id) setOver(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (open) onDrop(dragId, dropIndex(e));
        end();
      }}
    >
      <header className="flex min-h-9 items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-1.5 break-words text-sm font-semibold">
          {done && <CircleCheck aria-hidden className="size-4 shrink-0 text-ok" />}
          {label} <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{cards.length}</span>
        </h2>
        {menu}
      </header>
      <div className="flex min-h-32 flex-1 flex-col gap-3">
        {cards.length === 0 && !open && empty}
        {cards.map((c) => (
          <Fragment key={c.task.id}>
            {line === c.task.id && dropLine}
            <TaskCard
              task={c.task}
              hint={c.hint}
              onToggle={c.toggle}
              members={c.members}
              draggable={c.draggable}
              dragging={c.task.id === dragId}
              onOpen={() => onOpen(c.task.id)}
              onStep={(key) => onStep(c.task, key)}
              onDragStart={() => setDragId(c.task.id)}
              onDragEnd={end}
            />
          </Fragment>
        ))}
        {line === "end" && dropLine}
      </div>
      {footer}
    </section>
  );
}

/** A column of a real project: its menu (managers) and its "add a task" field (contributors). */
export function ProjectColumn({ projectId, column, index, count, canEdit, canManage, ...rest }: Omit<Parameters<typeof Column>[0], "id" | "label" | "menu" | "footer"> & {
  projectId: number;
  column: BoardColumn;
  index: number;
  count: number;
  canEdit: boolean;
  canManage: boolean;
}) {
  const { t, errorMessage } = useI18n();
  const ask = useAsk();
  const add = useProjectMutation(boardApi.createTask);
  const change = useProjectMutation(boardApi.updateColumn);
  const remove = useProjectMutation(boardApi.deleteColumn);
  const error = add.error ?? change.error ?? remove.error;
  const menu = canManage && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("board.columnActions", { name: column.name })}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          onSelect={async () => {
            const name = await ask({ title: t("board.renameColumn"), action: t("common.save"), field: { label: t("board.columnName"), value: column.name, max: 60 } });
            if (name) change.mutate({ id: projectId, columnId: column.id, name });
          }}
        >
          {t("board.renameColumn")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => change.mutate({ id: projectId, columnId: column.id, done: !column.done })}>
          {t(column.done ? "board.notDoneColumn" : "board.doneColumn")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === 0} onSelect={() => change.mutate({ id: projectId, columnId: column.id, position: index - 1 })}>
          {t("board.moveLeft")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === count - 1} onSelect={() => change.mutate({ id: projectId, columnId: column.id, position: index + 1 })}>
          {t("board.moveRight")}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-danger" onSelect={() => remove.mutate({ id: projectId, columnId: column.id })}>
          {t("common.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const footer = (
    <>
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
    </>
  );
  return <Column id={`c${column.id}`} label={column.name} done={column.done} menu={menu || undefined} footer={footer} {...rest} />;
}

/** The "add a column" button at the end of a board. */
export function AddColumn({ projectId }: { projectId: number }) {
  const { t, errorMessage } = useI18n();
  const ask = useAsk();
  const add = useProjectMutation(boardApi.createColumn);
  return (
    <div className="grid w-60 shrink-0 content-start gap-2">
      <Button
        variant="outline"
        onClick={async () => {
          const name = await ask({ title: t("board.addColumn"), action: t("board.addColumn"), field: { label: t("board.columnName"), max: 60 } });
          if (name) add.mutate({ id: projectId, name });
        }}
      >
        <Plus /> {t("board.addColumn")}
      </Button>
      {add.error && <Alert tone="danger">{errorMessage(add.error)}</Alert>}
    </div>
  );
}

// Where a press never starts panning: what can be clicked, typed in or dragged.
const NO_PAN = "[data-task], button, a, input, textarea, select, label, [role=menu]";

/** The row of columns: equal heights, cards gliding to their new place, a visible scrollbar,
 *  and the empty space grabbed with the mouse to scroll sideways (touch scrolls natively). */
export function Lane({ children, change }: { children: ReactNode; change: unknown }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ x: number; left: number } | null>(null);
  useFlip(scroller, change);
  return (
    <div
      ref={scroller}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || e.button !== 0 || (e.target as Element).closest(NO_PAN)) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setPan({ x: e.clientX, left: e.currentTarget.scrollLeft });
      }}
      onPointerMove={(e) => {
        if (pan) e.currentTarget.scrollLeft = pan.left - (e.clientX - pan.x);
      }}
      onPointerUp={() => setPan(null)}
      onPointerCancel={() => setPan(null)}
      className={cn(
        "lane-scroll -mx-1 flex scroll-px-1 items-stretch gap-4 overflow-x-auto px-1 pt-1 pb-4",
        pan ? "cursor-grabbing select-none" : "cursor-grab",
      )}
    >
      {children}
    </div>
  );
}

/** A project's kanban. */
export function Board({ project }: { project: Project }) {
  const { errorMessage } = useI18n();
  const { data: board, error } = useBoard(project.id);
  const { data: members = [] } = useMembers(project.id);
  const task = Number(useSearchParams().get("task")); // from My planning
  const [openId, setOpenId] = useState<number | null>(task || null);
  const dnd = useDnd();
  const move = useMoveTask(project.id);
  const setDone = useProjectMutation(boardApi.setDone, CARD_QUEUE);
  const canEdit = project.role !== "viewer" && !project.archived;
  const canManage = project.role === "manager" && !project.archived;
  const columns = board?.columns ?? [];
  const inColumn = (columnId: number) => board?.tasks.filter((t) => t.column_id === columnId) ?? [];
  const opened = board?.tasks.find((t) => t.id === openId);
  // A status only: the card stays where it is.
  const toggle = (task: BoardTask) => (canEdit ? () => setDone.mutate({ id: project.id, taskId: task.id, done: !task.done }) : undefined);

  // The keyboard alternative to dragging: Alt + arrows on a card's button.
  const step = (task: BoardTask, key: string) => {
    const index = columns.findIndex((c) => c.id === task.column_id);
    const across = key === "ArrowLeft" ? columns[index - 1] : key === "ArrowRight" ? columns[index + 1] : undefined;
    const here = inColumn(task.column_id).indexOf(task);
    const position = across ? inColumn(across.id).length : key === "ArrowUp" ? here - 1 : key === "ArrowDown" ? here + 1 : -1;
    if (position < 0 || (!across && !["ArrowUp", "ArrowDown"].includes(key))) return;
    move.mutate({ taskId: task.id, column_id: across?.id ?? task.column_id, position });
    refocus(task.id);
  };

  return (
    <div className="mb-6 grid gap-3">
      {(error ?? move.error ?? setDone.error) && <Alert tone="danger">{errorMessage(error ?? move.error ?? setDone.error)}</Alert>}
      <Lane change={[board, dnd.over]}>
        {columns.map((column, index) => (
          <ProjectColumn
            key={column.id}
            projectId={project.id}
            column={column}
            index={index}
            count={columns.length}
            canEdit={canEdit}
            canManage={canManage}
            cards={inColumn(column.id).map((t) => ({ task: t, members, draggable: canEdit, toggle: toggle(t) }))}
            dnd={dnd}
            onDrop={(taskId, position) => move.mutate({ taskId, column_id: column.id, position })}
            onOpen={setOpenId}
            onStep={step}
          />
        ))}
        {canManage && <AddColumn projectId={project.id} />}
      </Lane>
      <TaskDialog
        projectId={project.id}
        task={opened}
        onToggle={opened && toggle(opened)}
        members={members}
        canEdit={canEdit}
        canManage={canManage}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

/** After a keyboard move, the focus follows the card. */
export const refocus = (taskId: number) =>
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-task="${taskId}"] button`)?.focus());
