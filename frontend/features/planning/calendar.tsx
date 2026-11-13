"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { TaskDialog } from "@/features/board/task-dialog";
import type { BoardTask, CalendarEvent, Project } from "@/lib/api/client";
import { useBoard, useEvents, useMembers, useMyBoard, useMyEvents, useMyProject } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

import { iso } from "./dates";
import { EventDialog } from "./event-dialog";
import type { Draft, Item } from "./items";
import { Planner } from "./planner";

/** A dated card as a calendar item; cards have no times. */
function taskItem(task: BoardTask, today: string, open: () => void, hint?: string): Item | null {
  const from = task.start_date ?? task.due_date;
  const to = task.due_date ?? task.start_date;
  if (!from || !to) return null;
  return { key: `t${task.id}`, title: task.title, from, to, hint, color: task.labels[0], late: !!task.due_date && task.due_date < today, done: task.done, task: true, open };
}

const isItem = (i: Item | null): i is Item => !!i;

const eventItem = (e: CalendarEvent, open: (e: CalendarEvent) => void): Item => ({
  key: `e${e.id}`,
  title: e.title,
  from: e.start_date,
  to: e.end_date,
  start: e.start_time,
  end: e.end_time,
  color: e.color,
  open: () => open(e),
});

/** A project's calendar: its dated cards and its events. */
export function Calendar({ project }: { project: Project }) {
  const { errorMessage } = useI18n();
  const { data: board, error } = useBoard(project.id);
  const { data: events = [], error: eventsError } = useEvents(project.id);
  const { data: members = [] } = useMembers(project.id);
  const [openId, setOpenId] = useState<number | null>(null);
  const [event, setEvent] = useState<CalendarEvent | Draft | null>(null);
  const canEdit = project.role !== "viewer" && !project.archived;
  const canManage = project.role === "manager" && !project.archived;
  const today = iso(new Date());
  const items = [
    ...events.map((e) => eventItem(e, setEvent)),
    ...(board?.tasks.map((task) => taskItem(task, today, () => setOpenId(task.id))).filter(isItem) ?? []),
  ];
  const failure = error ?? eventsError;

  return (
    <div className="mb-6 grid gap-3">
      {failure && <Alert tone="danger">{errorMessage(failure)}</Alert>}
      <Planner items={items} onCreate={canEdit ? setEvent : undefined} />
      <TaskDialog
        projectId={project.id}
        task={board?.tasks.find((task) => task.id === openId)}
        members={members}
        canEdit={canEdit}
        canManage={canManage}
        onClose={() => setOpenId(null)}
      />
      <EventDialog projectId={project.id} kanban={board && { id: project.id, columns: board.columns }} event={event} canEdit={canEdit} onClose={() => setEvent(null)} />
    </div>
  );
}

/** My calendar: my personal events and cards, and the dated cards assigned to me in every project (each opens on its board). */
export function MyCalendar() {
  const { t, lang, errorMessage } = useI18n();
  const router = useRouter();
  const { data: board, error } = useMyBoard();
  const { data: personal } = useMyProject(lang);
  const { data: own } = useBoard(personal?.id ?? 0);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data: events = [], error: eventsError } = useMyEvents();
  const [event, setEvent] = useState<CalendarEvent | Draft | null>(null);
  const today = iso(new Date());
  const items = [
    ...events.map((e) => eventItem(e, setEvent)),
    ...(board?.tasks ?? [])
      .map((task) => {
        const name = board?.projects.find((p) => p.id === task.project_id)?.name;
        return taskItem(task, today, () => router.push(`/project/?id=${task.project_id}&task=${task.id}`), name);
      })
      .filter(isItem),
    ...(own?.tasks.map((task) => taskItem(task, today, () => setOpenId(task.id), t("kanban.personal"))).filter(isItem) ?? []),
  ];
  const failure = error ?? eventsError;
  return (
    <div className="mb-6 grid gap-3">
      {failure && <Alert tone="danger">{errorMessage(failure)}</Alert>}
      <Planner items={items} onCreate={setEvent} />
      <EventDialog projectId={null} kanban={personal && own && { id: personal.id, columns: own.columns }} event={event} canEdit onClose={() => setEvent(null)} />
      {personal && <TaskDialog projectId={personal.id} task={own?.tasks.find((task) => task.id === openId)} members={[]} canEdit canManage onClose={() => setOpenId(null)} />}
    </div>
  );
}
