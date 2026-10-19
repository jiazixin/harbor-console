import { useCallback, useEffect, useState } from "react";

import type { Locale } from "../../app/models";
import { loadProjectPage, type ProjectPageData } from "./project-detail-data";
import type { ProjectDetailRoute } from "./project-detail-routing";

/** Loads the data for the current project section and reloads on demand. */
export function useProjectPageData(
  routeState: ProjectDetailRoute,
  isSystemAdmin: boolean,
  locale: Locale,
): {
  data?: ProjectPageData;
  loading: boolean;
  error: string;
  reload: () => void;
} {
  const [data, setData] = useState<ProjectPageData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(
    () => setReloadToken((current) => current + 1),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadProjectPage(routeState, controller.signal, isSystemAdmin, locale)
      .then(setData)
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isSystemAdmin, locale, reloadToken, routeState]);

  return { data, loading, error, reload };
}
