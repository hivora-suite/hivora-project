"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  api,
  setCsrfToken,
  type Board,
  type BoardTask,
  type Candidate,
  type Me,
  type Membership,
  type Project,
  type ProjectMember,
  type ProjectRole,
  type Role,
  type SessionInfo,
  type TaskComment,
  type TaskEvent,
  type User,
} from "./client";

export const keys = { me: ["me"], users: ["users"], sessions: ["sessions"], projects: ["projects"] } as const;

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      const me = await api<Me>("/auth/me");
      setCsrfToken(me.csrf_token);
      return me;
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; password: string; totp_code?: string }) =>
      api<Me>("/auth/login", { method: "POST", body }),
    onSuccess: (me) => {
      setCsrfToken(me.csrf_token);
      qc.setQueryData(keys.me, me);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      setCsrfToken(null);
      qc.clear();
    },
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { current: string; new: string }) =>
      api<void>("/auth/password", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export const useMySessions = () =>
  useQuery({ queryKey: keys.sessions, queryFn: () => api<SessionInfo[]>("/auth/sessions") });

export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: () => api<User[]>("/users") });

export function useUserMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: keys.users }) });
}

export const userApi = {
  create: (b: { username: string; role: Role; password: string }) =>
    api<User>("/users", { method: "POST", body: b }),
  update: ({ id, ...b }: { id: number; role?: Role; disabled?: boolean }) =>
    api<User>(`/users/${id}`, { method: "PATCH", body: b }),
  remove: (id: number) => api<void>(`/users/${id}`, { method: "DELETE" }),
  resetPassword: ({ id, temporary }: { id: number; temporary: string }) =>
    api<void>(`/users/${id}/password`, { method: "POST", body: { temporary } }),
  resetTotp: (id: number) => api<void>(`/users/${id}/totp/reset`, { method: "POST" }),
  revokeSessions: (id: number) => api<void>(`/users/${id}/sessions`, { method: "DELETE" }),
};

export const useProjects = (archived: boolean) =>
  useQuery({
    queryKey: [...keys.projects, { archived }],
    queryFn: () => api<Project[]>("/projects", { query: { archived: String(archived) } }),
  });

export const useProject = (id: number) =>
  useQuery({ queryKey: [...keys.projects, id], queryFn: () => api<Project>(`/projects/${id}`), enabled: id > 0, retry: false });

export const useMembers = (id: number) =>
  useQuery({ queryKey: [...keys.projects, id, "members"], queryFn: () => api<ProjectMember[]>(`/projects/${id}/members`) });

export const useCandidates = (id: number) =>
  useQuery({ queryKey: [...keys.projects, id, "candidates"], queryFn: () => api<Candidate[]>(`/projects/${id}/candidates`) });

export const useUserMemberships = (userId: number) =>
  useQuery({
    queryKey: [...keys.projects, "of-user", userId],
    queryFn: () => api<Membership[]>(`/users/${userId}/projects`),
    enabled: userId > 0,
  });

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; language: string }) => api<Project>("/projects", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
  });
}

/** Any change to a project: everything shown about projects is read again. */
export function useProjectMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }) });
}

export const projectApi = {
  update: ({ id, ...b }: { id: number; name: string; description: string }) =>
    api<Project>(`/projects/${id}`, { method: "PATCH", body: b }),
  archive: (id: number) => api<Project>(`/projects/${id}/archive`, { method: "POST" }),
  unarchive: (id: number) => api<Project>(`/projects/${id}/unarchive`, { method: "POST" }),
  setMember: ({ id, userId, role }: { id: number; userId: number; role: ProjectRole }) =>
    api<void>(`/projects/${id}/members/${userId}`, { method: "PUT", body: { role } }),
  removeMember: ({ id, userId }: { id: number; userId: number }) =>
    api<void>(`/projects/${id}/members/${userId}`, { method: "DELETE" }),
};

export const useBoard = (id: number) =>
  useQuery({ queryKey: [...keys.projects, id, "board"], queryFn: () => api<Board>(`/projects/${id}/board`) });

export const boardApi = {
  createColumn: ({ id, name }: { id: number; name: string }) =>
    api<unknown>(`/projects/${id}/columns`, { method: "POST", body: { name } }),
  updateColumn: ({ id, columnId, ...b }: { id: number; columnId: number; name?: string; position?: number }) =>
    api<unknown>(`/projects/${id}/columns/${columnId}`, { method: "PATCH", body: b }),
  deleteColumn: ({ id, columnId }: { id: number; columnId: number }) =>
    api<void>(`/projects/${id}/columns/${columnId}`, { method: "DELETE" }),
  createTask: ({ id, ...b }: { id: number; title: string; column_id: number }) =>
    api<unknown>(`/projects/${id}/tasks`, { method: "POST", body: b }),
  updateTask: ({ id, taskId, ...b }: { id: number; taskId: number; title?: string; description?: string; start_date?: string | null; due_date?: string | null; labels?: BoardTask["labels"]; assignee_ids?: number[] }) =>
    api<unknown>(`/projects/${id}/tasks/${taskId}`, { method: "PATCH", body: b }),
  moveTask: ({ id, taskId, ...b }: { id: number; taskId: number; column_id: number; position: number }) =>
    api<unknown>(`/projects/${id}/tasks/${taskId}/move`, { method: "POST", body: b }),
  addItem: ({ id, taskId, title }: { id: number; taskId: number; title: string }) =>
    api<void>(`/projects/${id}/tasks/${taskId}/checklist`, { method: "POST", body: { title } }),
  updateItem: ({ id, itemId, ...b }: { id: number; itemId: number; done: boolean }) =>
    api<void>(`/projects/${id}/checklist/${itemId}`, { method: "PATCH", body: b }),
  deleteItem: ({ id, itemId }: { id: number; itemId: number }) =>
    api<void>(`/projects/${id}/checklist/${itemId}`, { method: "DELETE" }),
  deleteTask: ({ id, taskId }: { id: number; taskId: number }) =>
    api<void>(`/projects/${id}/tasks/${taskId}`, { method: "DELETE" }),
};

export const useComments = (id: number, taskId: number) =>
  useQuery({ queryKey: [...keys.projects, id, "comments", taskId], queryFn: () => api<TaskComment[]>(`/projects/${id}/tasks/${taskId}/comments`) });

export const useTaskHistory = (id: number, taskId: number) =>
  useQuery({ queryKey: [...keys.projects, id, "history", taskId], queryFn: () => api<TaskEvent[]>(`/projects/${id}/tasks/${taskId}/history`) });

export const commentApi = {
  add: ({ id, taskId, body }: { id: number; taskId: number; body: string }) =>
    api<void>(`/projects/${id}/tasks/${taskId}/comments`, { method: "POST", body: { body } }),
  edit: ({ id, commentId, body }: { id: number; commentId: number; body: string }) =>
    api<void>(`/projects/${id}/comments/${commentId}`, { method: "PATCH", body: { body } }),
  remove: ({ id, commentId }: { id: number; commentId: number }) =>
    api<void>(`/projects/${id}/comments/${commentId}`, { method: "DELETE" }),
};

type Move = { taskId: number; column_id: number; position: number };

function moved(tasks: BoardTask[], { taskId, column_id, position }: Move): BoardTask[] {
  const task = tasks.find((x) => x.id === taskId);
  if (!task) return tasks;
  const rest = tasks.filter((x) => x !== task);
  const siblings = rest.filter((x) => x.column_id === column_id);
  const at = position < siblings.length ? rest.indexOf(siblings[position]) : rest.length;
  return [...rest.slice(0, at), { ...task, column_id }, ...rest.slice(at)];
}

/** Moves a card at once on screen; the server's answer then confirms or corrects it. */
export function useMoveTask(id: number) {
  const qc = useQueryClient();
  const key = [...keys.projects, id, "board"];
  return useMutation({
    mutationFn: (v: Move) => boardApi.moveTask({ id, ...v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<Board>(key, (board) => board && { ...board, tasks: moved(board.tasks, v) });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
