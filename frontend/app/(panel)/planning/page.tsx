"use client";

import { PageHeader } from "@/components/app-shell";
import { MyCalendar } from "@/features/planning/calendar";
import { useI18n } from "@/lib/i18n";

export default function MyPlanningPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("nav.planning")} />
      <p className="-mt-4 mb-4 text-sm text-muted-foreground">{t("planning.mine")}</p>
      <MyCalendar />
    </>
  );
}
