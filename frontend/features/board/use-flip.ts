import { useLayoutEffect, useRef, type RefObject } from "react";

type Seen = { rect: DOMRect; slot: string };

/** Cards glide to their new place (FLIP): a card that changed column or rank since `change`
 *  is animated from where it was; one only shifted by a resize or a scroll is left alone. */
export function useFlip(root: RefObject<HTMLElement | null>, change: unknown) {
  const last = useRef(new Map<string, Seen>());
  useLayoutEffect(() => {
    const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, Seen>();
    const rank = new Map<Element | null, number>();
    root.current?.querySelectorAll<HTMLElement>("[data-task]").forEach((card) => {
      const id = card.dataset.task!;
      const rect = card.getBoundingClientRect();
      const column = card.closest("section");
      rank.set(column, (rank.get(column) ?? -1) + 1);
      const slot = `${column?.getAttribute("aria-label")}:${rank.get(column)}`;
      next.set(id, { rect, slot });
      const seen = last.current.get(id);
      if (!seen || !animate || seen.slot === slot) return;
      const before = seen.rect;
      const [x, y] = [before.left - rect.left, before.top - rect.top];
      if (x || y) {
        card.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }], {
          duration: 260,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
      }
    });
    last.current = next;
  }, [root, change]);
}
