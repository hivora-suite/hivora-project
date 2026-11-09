"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import type { FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { ProjectHeader, ProjectScreen } from "@/features/projects/project-screen";
import type { Project } from "@/lib/api/client";
import { projectApi, useProjectMutation } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

function Settings({ project }: { project: Project }) {
  const { t, errorMessage } = useI18n();
  const update = useProjectMutation(projectApi.update);
  const archive = useProjectMutation(projectApi.archive);
  const unarchive = useProjectMutation(projectApi.unarchive);
  const error = update.error ?? archive.error ?? unarchive.error;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    update.mutate({ id: project.id, name: String(f.get("name")), description: String(f.get("description")) });
  };
  return (
    <>
      <ProjectHeader
        project={project}
        title={t("project.tab.settings")}
        actions={
          project.archived ? (
            <Button variant="outline" loading={unarchive.isPending} onClick={() => unarchive.mutate(project.id)}>
              <ArchiveRestore /> {t("projects.unarchive")}
            </Button>
          ) : (
            <Button variant="outline" loading={archive.isPending} onClick={() => archive.mutate(project.id)}>
              <Archive /> {t("projects.archive")}
            </Button>
          )
        }
      />
      <Card className="max-w-xl">
        <CardContent className="pt-5">
          <form key={`${project.name}|${project.description}`} className="grid gap-4" onSubmit={submit}>
            <fieldset disabled={project.archived} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="name">{t("projects.name")}</Label>
                <Input id="name" name="name" defaultValue={project.name} required maxLength={120} autoComplete="off" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="description">{t("projects.description")}</Label>
                <Input id="description" name="description" defaultValue={project.description} maxLength={5000} autoComplete="off" />
              </div>
            </fieldset>
            {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
            {!project.archived && (
              <Button type="submit" className="justify-self-start" loading={update.isPending} disabled={update.isPending}>
                {t("common.save")}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </>
  );
}

export default function ProjectSettingsPage() {
  const { t } = useI18n();
  return (
    <ProjectScreen>
      {(project) => (project.role === "manager" ? <Settings project={project} /> : <Alert tone="danger">{t("error.insufficient_role")}</Alert>)}
    </ProjectScreen>
  );
}
