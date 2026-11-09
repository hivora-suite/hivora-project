"use client";

import { FolderPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PageHeader } from "@/components/app-shell";
import { ShelfCat } from "@/components/shelf-cat";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Switch } from "@/components/ui/input";
import { useCreateProject, useProjects } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects?.map((p) => (
          <Link key={p.id} href={`/project/?id=${p.id}`} className="surface grid gap-2 rounded-xl p-5 transition-transform hover:-translate-y-0.5">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 break-words font-semibold">{p.name}</span>
              {p.archived && <Badge>{t("projects.archived")}</Badge>}
            </span>
            {p.description && <span className="line-clamp-2 text-sm text-muted-foreground">{p.description}</span>}
            <span className="text-xs text-muted-foreground">{t(`projectRole.${p.role}`)}</span>
          </Link>
        ))}
      </div>
      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
