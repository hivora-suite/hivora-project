"use client";

import { ChevronsDownUp, ChevronsUpDown, Minus, Pin, Plus, SlidersHorizontal, SquareKanban, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Collapse } from "@/components/ui/collapse";
import { projectApi, useProject, useProjectMutation, useProjects } from "@/lib/api/hooks";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { readPref, writePref } from "@/lib/prefs";
import { cn } from "@/lib/utils";

import { useProjectId } from "./project-screen";

const TABS: { path: string; label: MessageKey; icon: typeof Users; manager?: boolean }[] = [
  { path: "/project/", label: "project.tab.board", icon: SquareKanban },
  { path: "/project/members/", label: "project.tab.members", icon: Users },
  { path: "/project/settings/", label: "project.tab.settings", icon: SlidersHorizontal, manager: true },
];

const SMALL_BUTTON = "text-muted-foreground transition-colors hover:text-foreground";

/** The "Projects" entry (`link`) with every project under it, each unfolding to its tabs;
 *  what is unfolded is remembered in this browser. */
export function ProjectNav({ link }: { link: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const urlId = useProjectId();
  const current = pathname.startsWith("/project/") ? urlId : 0;
  const { data: all = [] } = useProjects(false);
  const projects = all.filter((p) => p.pinned);
  const { data: opened } = useProject(current);
  const pin = useProjectMutation(projectApi.pin);
  // An unpinned or archived project is not in the list, but its tabs are needed while it is open.
  const listed = opened && !projects.some((p) => p.id === opened.id) ? [...projects, opened] : projects;
  const [expanded, setExpanded] = useState<number[]>(() => (readPref("nav.projects") ?? "").split(",").map(Number).filter(Boolean));
  const save = (ids: number[]) => {
    setExpanded(ids);
    writePref("nav.projects", ids.join(","));
  };
  // Opening a project unfolds it; it can then be folded again while there.
  useEffect(() => {
    if (current && !expanded.includes(current)) save([...expanded, current]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!listed.length) return link;
  const allOpen = listed.every((p) => expanded.includes(p.id));
  const toggleAll = t(allOpen ? "project.collapseAll" : "project.expandAll");
  return (
    <>
      <div className="relative">
        {link}
        <button
          type="button"
          aria-label={toggleAll}
          title={toggleAll}
          onClick={() => save(allOpen ? [] : listed.map((p) => p.id))}
          className={cn(SMALL_BUTTON, "absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded hover:bg-muted")}
        >
          {allOpen ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
        </button>
      </div>
      <div className="ml-3 flex flex-col divide-y border-l pl-3">
        {listed.map((p) => {
          const open = expanded.includes(p.id);
          return (
            <div key={p.id} className="py-2">
              <div className={cn("flex flex-col gap-1 rounded-md transition-[background-color,box-shadow,padding] duration-200 ease-out", open && "surface p-2")}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={t(open ? "project.collapse" : "project.expand", { name: p.name })}
                  onClick={() => save(open ? expanded.filter((id) => id !== p.id) : [...expanded, p.id])}
                  className={cn(SMALL_BUTTON, "grid size-5 shrink-0 place-items-center rounded hover:bg-muted")}
                >
                  {open ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                </button>
                <Link
                  href={`/project/?id=${p.id}`}
                  className={cn("min-w-0 flex-1 truncate rounded-md px-1 py-1.5 text-sm font-medium", p.id === current ? "font-semibold" : "text-foreground/80 hover:text-foreground")}
                >
                  {p.name}
                </Link>
                {p.id === current && (
                  <button
                    type="button"
                    aria-label={t("projects.pin", { name: p.name })}
                    aria-pressed={p.pinned}
                    title={t("projects.pin", { name: p.name })}
                    onClick={() => pin.mutate({ id: p.id, pinned: !p.pinned })}
                    className={cn(SMALL_BUTTON, "grid size-5 shrink-0 place-items-center rounded hover:bg-muted", p.pinned && "text-primary")}
                  >
                    <Pin className={cn("size-3.5", p.pinned && "fill-current")} />
                  </button>
                )}
              </div>
              <Collapse open={open}>
                <div className="ml-2 flex flex-col gap-1">
                  {TABS.filter((tab) => !tab.manager || p.role === "manager").map((tab) => {
                  const active = p.id === current && pathname === tab.path;
                  return (
                    <Link
                      key={tab.path}
                      href={`${tab.path}?id=${p.id}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <tab.icon className="size-4 shrink-0" /> {t(tab.label)}
                    </Link>
                  );
                  })}
                </div>
              </Collapse>
            </div>
              </div>
          );
        })}
      </div>
    </>
  );
}
