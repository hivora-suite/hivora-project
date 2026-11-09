"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { PageHeader, useSession } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import type { Project, ProjectRole } from "@/lib/api/client";
import { projectApi, useCandidates, useMembers, useProject, useProjectMutation } from "@/lib/api/hooks";
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

function DetailsCard({ project }: { project: Project }) {
  const { t, errorMessage } = useI18n();
  const update = useProjectMutation(projectApi.update);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    update.mutate({ id: project.id, name: String(f.get("name")), description: String(f.get("description")) });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("projects.details")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="name">{t("projects.name")}</Label>
            <Input id="name" name="name" defaultValue={project.name} required maxLength={120} autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="description">{t("projects.description")}</Label>
            <Input id="description" name="description" defaultValue={project.description} maxLength={5000} autoComplete="off" />
          </div>
          {update.error && <Alert tone="danger">{errorMessage(update.error)}</Alert>}
          <Button type="submit" className="justify-self-start" loading={update.isPending} disabled={update.isPending}>
            {t("common.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
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

function MembersCard({ project }: { project: Project }) {
  const { t, errorMessage } = useI18n();
  const { me } = useSession();
  const { data: members } = useMembers(project.id);
  const setRole = useProjectMutation(projectApi.setMember);
  const remove = useProjectMutation(projectApi.removeMember);
  const canManage = project.role === "manager" && !project.archived;
  const busy = setRole.isPending || remove.isPending;
  const error = setRole.error ?? remove.error;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("projects.members")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
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
      </CardContent>
    </Card>
  );
}

function ProjectView() {
  const { t, errorMessage } = useI18n();
  const id = Number(useSearchParams().get("id"));
  const { data: project, error } = useProject(id);
  const archive = useProjectMutation(projectApi.archive);
  const unarchive = useProjectMutation(projectApi.unarchive);

  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  if (!project) return null;
  const manager = project.role === "manager";
  const actionError = archive.error ?? unarchive.error;
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {project.name}
            {project.archived && <Badge>{t("projects.archived")}</Badge>}
          </span>
        }
        actions={
          manager &&
          (project.archived ? (
            <Button variant="outline" loading={unarchive.isPending} onClick={() => unarchive.mutate(id)}>
              <ArchiveRestore /> {t("projects.unarchive")}
            </Button>
          ) : (
            <Button variant="outline" loading={archive.isPending} onClick={() => archive.mutate(id)}>
              <Archive /> {t("projects.archive")}
            </Button>
          ))
        }
      />
      {actionError && <Alert tone="danger" className="mb-4">{errorMessage(actionError)}</Alert>}
      <div className="stagger grid items-start gap-4 xl:grid-cols-2">
        {manager && !project.archived ? (
          <DetailsCard key={`${project.name}|${project.description}`} project={project} />
        ) : (
          project.description && <p className="surface rounded-xl p-5 text-sm">{project.description}</p>
        )}
        <MembersCard project={project} />
      </div>
    </>
  );
}

export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectView />
    </Suspense>
  );
}
