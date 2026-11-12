"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import type { BoardTask, MyBoard } from "@/lib/api/client";
import { useBoard, useMembers, useMoveMine, useMyBoard, useMyProject } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

import { AddColumn, Column, Lane, ProjectColumn, refocus, useDnd, type Card } from "./board";
import { TaskDialog } from "./task-dialog";

type Filed = MyBoard["tasks"][number];
type Role = MyBoard["projects"][number]["role"];

/** A project card opened from My kanban, with its project's members and my role there. */
function OpenCard({ task, role, onClose }: { task: Filed; role: Role; onClose: () => void }) {
  const { data: members = [] } = useMembers(task.project_id);
  return <TaskDialog projectId={task.project_id} task={task} members={members} canEdit={role !== "viewer"} canManage={role === "manager"} onClose={onClose} />;
}

/** My kanban: a fixed column of my project cards, then my own columns, where my cards and the
 *  project cards I file there share one order. A project card never moves in its project here. */
export function MyKanban() {
  const { t, lang, errorMessage } = useI18n();
  const { data: personal, error } = useMyProject(lang);
  const { data: own } = useBoard(personal?.id ?? 0);
  const { data: mine, error: mineError } = useMyBoard();
  const move = useMoveMine(personal?.id ?? 0);
  const dnd = useDnd();
  const [openId, setOpenId] = useState<number | null>(null);
  if (error ?? mineError) return <Alert tone="danger">{errorMessage(error ?? mineError)}</Alert>;
  if (!personal || !own || !mine) return null;

  const columns = own.columns;
  const projectName = (task: Filed) => mine.projects.find((p) => p.id === task.project_id)?.name;
  const isFiled = (id: number) => mine.tasks.some((task) => task.id === id);
  const cardsIn = (columnId: number | null): Card[] =>
    columnId === null
      ? mine.tasks.filter((task) => task.personal_column_id === null).map((task) => ({ task, hint: projectName(task), members: [], draggable: true }))
      : [
          ...own.tasks.filter((task) => task.column_id === columnId).map((task) => ({ at: task.position, filed: 0, card: { task, members: [], draggable: true } as Card })),
          ...mine.tasks
            .filter((task) => task.personal_column_id === columnId)
            .map((task) => ({ at: task.personal_position ?? 0, filed: 1, card: { task, hint: projectName(task), members: [], draggable: true } as Card })),
        ]
          .sort((a, b) => a.at - b.at || a.filed - b.filed)
          .map((x) => x.card);
  const columnOf = (task: BoardTask) => (isFiled(task.id) ? (mine.tasks.find((x) => x.id === task.id)?.personal_column_id ?? null) : task.column_id);

  // Alt + arrows: a column left or right (left of my first column is back among the project
  // tasks, for a project card), or a place up or down.
  const step = (task: BoardTask, key: string) => {
    const here = columnOf(task);
    const index = here === null ? -1 : columns.findIndex((c) => c.id === here);
    const across = key === "ArrowLeft" ? (index > 0 ? columns[index - 1].id : index === 0 && isFiled(task.id) ? null : undefined) : key === "ArrowRight" ? columns[index + 1]?.id : undefined;
    const at = cardsIn(here).findIndex((c) => c.task.id === task.id);
    if (across !== undefined) move.mutate({ taskId: task.id, column_id: across, position: across === null ? 0 : cardsIn(across).length });
    else if (here !== null && (key === "ArrowUp" || key === "ArrowDown")) {
      const position = at + (key === "ArrowUp" ? -1 : 1);
      if (position < 0 || position >= cardsIn(here).length) return;
      move.mutate({ taskId: task.id, column_id: here, position });
    } else return;
    refocus(task.id);
  };
  const opened = mine.tasks.find((task) => task.id === openId);

  return (
    <div className="mb-6 grid gap-3">
      {move.error && <Alert tone="danger">{errorMessage(move.error)}</Alert>}
      <Lane change={[own, mine, dnd.over]}>
        <Column
          id="projects"
          label={t("kanban.projects")}
          cards={cardsIn(null)}
          dnd={dnd}
          accepts={isFiled}
          onDrop={(taskId) => move.mutate({ taskId, column_id: null, position: 0 })}
          onOpen={setOpenId}
          onStep={step}
          empty={<p className="text-sm text-muted-foreground">{t("kanban.noProjectTasks")}</p>}
        />
        {columns.map((column, index) => (
          <ProjectColumn
            key={column.id}
            projectId={personal.id}
            column={column}
            index={index}
            count={columns.length}
            canEdit
            canManage
            cards={cardsIn(column.id)}
            dnd={dnd}
            onDrop={(taskId, position) => move.mutate({ taskId, column_id: column.id, position })}
            onOpen={setOpenId}
            onStep={step}
          />
        ))}
        <AddColumn projectId={personal.id} />
      </Lane>
      {opened ? (
        <OpenCard task={opened} role={mine.projects.find((p) => p.id === opened.project_id)?.role ?? "viewer"} onClose={() => setOpenId(null)} />
      ) : (
        <TaskDialog projectId={personal.id} task={own.tasks.find((task) => task.id === openId)} members={[]} canEdit canManage onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
