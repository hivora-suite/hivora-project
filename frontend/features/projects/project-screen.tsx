"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { PageHeader } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/lib/api/client";
import { useProject } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

export const useProjectId = () => Number(useSearchParams().get("id"));

function Loaded({ children }: { children: (project: Project) => ReactNode }) {
  const { errorMessage } = useI18n();
  const { data: project, error } = useProject(useProjectId());
  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  return project ? children(project) : null;
}

/** A tab of a project: the project comes from `?id=`; statically exported, so no path segment. */
export function ProjectScreen({ children }: { children: (project: Project) => ReactNode }) {
  return (
    <Suspense>
      <Loaded>{children}</Loaded>
    </Suspense>
  );
}

export function ProjectHeader({ project, title, actions }: { project: Project; title: string; actions?: ReactNode }) {
  const { t } = useI18n();
  return (
    <PageHeader
      title={
        <span className="flex flex-wrap items-center gap-3">
          {title}
          {project.archived && <Badge>{t("projects.archived")}</Badge>}
        </span>
      }
      actions={actions}
    />
  );
}
