"use client";

import { Board } from "@/features/board/board";
import { ProjectHeader, ProjectScreen } from "@/features/projects/project-screen";

export default function ProjectBoardPage() {
  return (
    <ProjectScreen>
      {(project) => (
        <>
          <ProjectHeader project={project} title={project.name} />
          <Board project={project} />
        </>
      )}
    </ProjectScreen>
  );
}
