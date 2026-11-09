"use client";

import { PageHeader } from "@/components/app-shell";
import { ShelfCat } from "@/components/shelf-cat";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("home.title")} />
      <div className="surface grid max-w-md gap-4 rounded-xl p-6">
        <p className="text-sm text-muted-foreground">{t("home.empty")}</p>
        <ShelfCat />
      </div>
    </>
  );
}
