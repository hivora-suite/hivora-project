"use client";

import { Calendar } from "@/features/planning/calendar";
import { ProjectHeader, ProjectScreen } from "@/features/projects/project-screen";
import { useI18n } from "@/lib/i18n";

export default function ProjectPlanningPage() {
  const { t } = useI18n();
  return (
    <ProjectScreen>
      {(project) => (
        <>
          <ProjectHeader project={project} title={t("project.tab.planning")} />
          <Calendar project={project} />
        </>
      )}
    </ProjectScreen>
  );
}
