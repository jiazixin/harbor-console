import { type RefObject, useLayoutEffect } from "react";

export function useCenterActiveTab(
  containerRef: RefObject<HTMLElement | null>,
  dependency: unknown,
) {
  useLayoutEffect(() => {
    const tabs = containerRef.current;
    const active = tabs?.querySelector<HTMLElement>(".active");
    if (!tabs || !active || tabs.scrollWidth <= tabs.clientWidth) return;
    const activeLeft = active.offsetLeft;
    const activeRight = activeLeft + active.offsetWidth;
    const visibleLeft = tabs.scrollLeft;
    const visibleRight = visibleLeft + tabs.clientWidth;
    if (activeLeft >= visibleLeft && activeRight <= visibleRight) return;
    tabs.scrollLeft = Math.max(
      0,
      activeLeft - (tabs.clientWidth - active.offsetWidth) / 2,
    );
  }, [containerRef, dependency]);
}
