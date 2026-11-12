import type { BoardTask } from "@/lib/api/client";

/** Label colours are design tokens: a card only stores their names. */
export const LABELS: Record<BoardTask["labels"][number], string> = {
  red: "bg-label-red",
  orange: "bg-label-orange",
  amber: "bg-label-amber",
  lime: "bg-label-lime",
  green: "bg-label-green",
  teal: "bg-label-teal",
  cyan: "bg-label-cyan",
  blue: "bg-label-blue",
  indigo: "bg-label-indigo",
  violet: "bg-label-violet",
  pink: "bg-label-pink",
  gray: "bg-label-gray",
};
