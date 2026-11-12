"use client";

import { FolderPlus, Pin, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PageHeader } from "@/components/app-shell";
import { useAsk } from "@/components/ask";
import { ShelfCat } from "@/components/shelf-cat";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Switch } from "@/components/ui/input";
import { projectApi, useCreateProject, useProjectMutation, useProjects } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, lang, errorMessage } = useI18n();
  const router = useRouter();
  const create = useCreateProject();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    create.mutate({ name: String(new FormData(e.currentTarget).get("name")), language: lang }, {
      onSuccess: (project) => router.push(`/project/?id=${project.id}`),
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("projects.new")} closeLabel={t("common.close")}>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="project-name">{t("projects.name")}</Label>
            <Input id="project-name" name="name" required maxLength={120} autoComplete="off" autoFocus />
          </div>
          {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
          <Button type="submit" loading={create.isPending} disabled={create.isPending}>
            {t("projects.create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const { t, errorMessage } = useI18n();
  const ask = useAsk();
  const remove = useProjectMutation(projectApi.remove);
  const pin = useProjectMutation(projectApi.pin);
  const error = remove.error ?? pin.error;
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data: projects } = useProjects(archived);
  return (
    <>
      <PageHeader
        title={t("home.title")}
        actions={
          <Button onClick={() => setCreating(true)}>
            <FolderPlus /> {t("projects.new")}
          </Button>
        }
      />
      <label className="mb-4 flex items-center gap-2 text-sm">
        <Switch checked={archived} onChange={(e) => setArchived(e.target.checked)} />
        {t("projects.showArchived")}
      </label>
      {projects?.length === 0 && (
        <div className="surface grid max-w-md gap-4 rounded-xl p-6">
          <p className="text-sm text-muted-foreground">{t("projects.empty")}</p>
          <ShelfCat />
        </div>
      )}
      {error && <Alert tone="danger" className="mb-4">{errorMessage(error)}</Alert>}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects?.map((p) => (
          <div key={p.id} className="relative grid transition-transform hover:-translate-y-0.5">
          <Link href={`/project/?id=${p.id}`} className="surface grid gap-2 rounded-xl p-5">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 break-words font-semibold">{p.name}</span>
              {p.archived && <Badge>{t("projects.archived")}</Badge>}
            </span>
            {p.description && <span className="line-clamp-2 text-sm text-muted-foreground">{p.description}</span>}
            <span className="text-xs text-muted-foreground">{t(`projectRole.${p.role}`)}</span>
          </Link>
          <span className="absolute bottom-3 right-3 flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("projects.pin", { name: p.name })}
            aria-pressed={p.pinned}
            className={cn("size-7 hover:text-foreground", p.pinned ? "text-primary" : "text-muted-foreground")}
            onClick={() => pin.mutate({ id: p.id, pinned: !p.pinned })}
          >
            <Pin className={cn("size-3.5", p.pinned && "fill-current")} />
          </Button>
          {p.role === "manager" && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("projects.delete", { name: p.name })}
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={async () => {
                if ((await ask({ title: t("projects.deleteConfirm", { name: p.name }), action: t("common.delete"), danger: true })) !== null) remove.mutate(p.id);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          </span>
          </div>
        ))}
      </div>
      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
