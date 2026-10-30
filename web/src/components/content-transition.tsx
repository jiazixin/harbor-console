import { type ReactNode, useLayoutEffect, useRef } from "react";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";

/** Animate structural changes without remounting data, forms or scroll owners. */
type ContentTransitionProps = {
  mode: string;
  children: ReactNode;
};

export function ContentTransition({ mode, children }: ContentTransitionProps) {
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
    const cancel = () => {
      animation.cancel();
    };
    reducedMotion.addEventListener("change", cancel);
    return () => {
      cancel();
      reducedMotion.removeEventListener("change", cancel);
    };
  }, [mode]);

  return (
    <div ref={ref} className={resolveClasses("content-transition")}>
      {children}
    </div>
  );
}

const resolveClasses = createClassNames({
  "harbor-banner-warning": uiStyles0.harborBannerWarning,
  "harbor-banner-success": uiStyles0.harborBannerSuccess,
  "harbor-banner-info": uiStyles0.harborBannerInfo,
  "harbor-banner-danger": uiStyles0.harborBannerDanger,
  clickable: uiStyles0.clickable,
  "overlay-open": uiStyles0.overlayOpen,
  "log-level-trace": uiStyles0.logLevelTrace,
  "log-level-debug": uiStyles0.logLevelDebug,
  "log-level-log": uiStyles0.logLevelLog,
  "log-level-info": uiStyles0.logLevelInfo,
  "log-level-warn": uiStyles0.logLevelWarn,
  "log-level-error": uiStyles0.logLevelError,
  "log-level-fatal": uiStyles0.logLevelFatal,
});
