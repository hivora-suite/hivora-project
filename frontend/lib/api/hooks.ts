"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, setCsrfToken, type Me, type Role, type SessionInfo, type User } from "./client";

export const keys = { me: ["me"], users: ["users"], sessions: ["sessions"] } as const;

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
