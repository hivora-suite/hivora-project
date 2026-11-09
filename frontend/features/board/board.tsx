"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";

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
import { boardApi, useBoard, useMembers, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

import { TaskDialog } from "./task-dialog";

function Column({ projectId, column, tasks, members, canEdit, canManage, onOpen }: {
  projectId: number;
  column: BoardColumn;
  tasks: BoardTask[];
  members: ProjectMember[];
  canEdit: boolean;
  canManage: boolean;
  onOpen: (taskId: number) => void;
}) {
  const { t, errorMessage } = useI18n();
  const add = useProjectMutation(boardApi.createTask);
  const rename = useProjectMutation(boardApi.updateColumn);
  const remove = useProjectMutation(boardApi.deleteColumn);
  const error = add.error ?? rename.error ?? remove.error;
  const nameOf = (id: number | null) => members.find((m) => m.user_id === id)?.username;

  return (
    <section aria-label={column.name} className="surface flex w-72 shrink-0 flex-col gap-3 rounded-xl p-3">
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
              <DropdownMenuItem className="text-danger" onSelect={() => remove.mutate({ id: projectId, columnId: column.id })}>
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          onClick={() => onOpen(task.id)}
          className="grid gap-1 rounded-md border bg-card p-2.5 text-left text-sm transition-colors hover:border-primary"
        >
          <span className="break-words font-medium">{task.title}</span>
          {task.assignee_id !== null && <span className="text-xs text-muted-foreground">{nameOf(task.assignee_id)}</span>}
        </button>
      ))}
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
  const addColumn = useProjectMutation(boardApi.createColumn);
  const canEdit = project.role !== "viewer" && !project.archived;
  const canManage = project.role === "manager" && !project.archived;
  const failure = error ?? addColumn.error;

  return (
    <div className="mb-6 grid gap-3">
      {failure && <Alert tone="danger">{errorMessage(failure)}</Alert>}
      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        {board?.columns.map((column) => (
          <Column
            key={column.id}
            projectId={project.id}
            column={column}
            tasks={board.tasks.filter((task) => task.column_id === column.id)}
            members={members}
            canEdit={canEdit}
            canManage={canManage}
            onOpen={setOpenId}
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
        task={board?.tasks.find((task) => task.id === openId)}
        members={members}
        canEdit={canEdit}
        canManage={canManage}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
