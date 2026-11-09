"use client";

import { useQuery } from "@tanstack/react-query";

import { Brand } from "@/components/brand";
import { ShelfCat } from "@/components/shelf-cat";
import { api, type Health } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function Home() {
  const { t } = useI18n();
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => api<Health>("/system/health"),
  });
  const label = isError ? t("home.error") : data ? t("home.ok") : t("home.loading");
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="surface animate-enter grid w-full max-w-sm justify-items-center gap-6 rounded-xl p-8 text-center">
        <Brand large />
        <div className="grid gap-2">
          <h1 className="text-xl font-semibold">{t("home.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("home.text")}</p>
        </div>
        <div className="w-full">
          <ShelfCat />
        </div>
        <p role="status" className="flex items-center gap-2 text-sm">
          <span aria-hidden className={cn("size-2 rounded-full", isError ? "bg-danger" : data ? "bg-ok" : "bg-idle")} />
          {label}
          {data && <span className="font-mono text-xs text-muted-foreground">v{data.version}</span>}
        </p>
      </div>
    </main>
  );
}
