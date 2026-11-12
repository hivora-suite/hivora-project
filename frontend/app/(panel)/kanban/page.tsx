"use client";

import { Suspense } from "react";

import { PageHeader } from "@/components/app-shell";
import { MyKanban } from "@/features/board/my-kanban";
import { useI18n } from "@/lib/i18n";

export default function MyKanbanPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("nav.kanban")} />
      <p className="-mt-4 mb-4 text-sm text-muted-foreground">{t("kanban.mine")}</p>
      <Suspense>
        <MyKanban />
      </Suspense>
    </>
  );
}
