import type { BoardTask } from "@/lib/api/client";

/** Label colours are design tokens: a card only stores their names. */
export const LABELS: Record<BoardTask["labels"][number], string> = {
  green: "bg-ok",
  blue: "bg-info",
  amber: "bg-warn",
  red: "bg-danger",
  violet: "bg-primary",
  gray: "bg-idle",
};
