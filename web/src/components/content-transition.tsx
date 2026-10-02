import { type ReactNode, useLayoutEffect, useRef } from "react";

/** Animate structural changes without remounting data, forms or scroll owners. */
export function ContentTransition({
  mode,
  children,
}: {
  mode: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previousMode = useRef(mode);

  useLayoutEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    const element = ref.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element?.animate || reducedMotion.matches) return;
    const tokens = getComputedStyle(element);
    const animation = element.animate([{ opacity: 0.85 }, { opacity: 1 }], {
      duration: Number.parseFloat(tokens.getPropertyValue("--motion-standard")),
      easing: tokens.getPropertyValue("--motion-ease").trim(),
    });
    const cancel = () => animation.cancel();
    reducedMotion.addEventListener("change", cancel);
    return () => {
      cancel();
      reducedMotion.removeEventListener("change", cancel);
    };
  }, [mode]);

  return (
    <div ref={ref} className="content-transition">
      {children}
    </div>
  );
}
