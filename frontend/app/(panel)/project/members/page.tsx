"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { ProjectHeader, ProjectScreen } from "@/features/projects/project-screen";
import type { Project, ProjectRole } from "@/lib/api/client";
import { projectApi, useCandidates, useMembers, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

const ROLES: ProjectRole[] = ["manager", "contributor", "viewer"];

function RoleSelect({ id, value, disabled, label, onChange }: { id?: string; value: ProjectRole; disabled?: boolean; label?: string; onChange: (r: ProjectRole) => void }) {
  const { t } = useI18n();
  return (
    <Select id={id} aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as ProjectRole)}>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {t(`projectRole.${r}`)}
        </option>
      ))}
    </Select>
  );
}

function AddMember({ projectId }: { projectId: number }) {
  const { t, errorMessage } = useI18n();
  const { data: candidates } = useCandidates(projectId);
  const [role, setRole] = useState<ProjectRole>("contributor");
  const add = useProjectMutation(projectApi.setMember);
  if (!candidates?.length) return <p className="text-sm text-muted-foreground">{t("projects.noCandidates")}</p>;
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        add.mutate({ id: projectId, userId: Number(new FormData(form).get("user")), role }, { onSuccess: () => form.reset() });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-40 flex-1 gap-1.5">
          <Label htmlFor="candidate">{t("projects.addMember")}</Label>
          <Select id="candidate" name="user">
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.username}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid min-w-40 gap-1.5">
          <Label htmlFor="candidate-role">{t("projects.role")}</Label>
          <RoleSelect id="candidate-role" value={role} onChange={setRole} />
        </div>
        <Button type="submit" loading={add.isPending} disabled={add.isPending}>
          {t("projects.add")}
        </Button>
      </div>
      {add.error && <Alert tone="danger">{errorMessage(add.error)}</Alert>}
    </form>
  );
}

function Members({ project }: { project: Project }) {
  const { t, errorMessage } = useI18n();
  const { me } = useSession();
  const { data: members } = useMembers(project.id);
  const setRole = useProjectMutation(projectApi.setMember);
  const remove = useProjectMutation(projectApi.removeMember);
  const canManage = project.role === "manager" && !project.archived;
  const busy = setRole.isPending || remove.isPending;
  const error = setRole.error ?? remove.error;
  return (
    <div className="grid max-w-3xl gap-4">
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
      <Table>
        <THead>
          <tr>
            <Th>{t("users.username")}</Th>
            <Th>{t("projects.role")}</Th>
            {canManage && <Th />}
          </tr>
        </THead>
        <TBody>
          {members?.map((m) => (
            <Tr key={m.user_id}>
              <Td>
                <span className="font-medium">{m.username}</span>
                {m.user_id === me.id && <span className="ml-2 text-xs text-muted-foreground">({t("users.you")})</span>}
              </Td>
              <Td>
                {canManage ? (
                  <RoleSelect
                    label={t("projects.roleOf", { name: m.username })}
                    value={m.role}
                    disabled={busy}
                    onChange={(role) => setRole.mutate({ id: project.id, userId: m.user_id, role })}
                  />
                ) : (
                  t(`projectRole.${m.role}`)
                )}
              </Td>
              {canManage && (
                <Td className="py-1 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    loading={busy}
                    aria-label={t("projects.removeMember", { name: m.username })}
                    onClick={() => remove.mutate({ id: project.id, userId: m.user_id })}
                  >
                    <Trash2 />
                  </Button>
                </Td>
              )}
            </Tr>
          ))}
        </TBody>
      </Table>
      {canManage && <AddMember projectId={project.id} />}
    </div>
  );
}

export default function ProjectMembersPage() {
  const { t } = useI18n();
  return (
    <ProjectScreen>
      {(project) => (
        <>
          <ProjectHeader project={project} title={t("project.tab.members")} />
          <Members project={project} />
        </>
      )}
    </ProjectScreen>
  );
}
