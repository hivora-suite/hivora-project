import { useLayoutEffect, useRef, type RefObject } from "react";

/** Cards glide to their new place (FLIP): each is animated from where it was before `change`. */
export function useFlip(root: RefObject<HTMLElement | null>, change: unknown) {
  const last = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, DOMRect>();
    root.current?.querySelectorAll<HTMLElement>("[data-task]").forEach((card) => {
      const id = card.dataset.task!;
      const rect = card.getBoundingClientRect();
      next.set(id, rect);
      const before = last.current.get(id);
      if (!before || !animate) return;
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
