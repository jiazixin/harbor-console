import type { Locale } from "../../app/models";
import { useLoadedQuery, type LoadedQuery } from "../../app/use-loaded-query";
import { loadProjectPage, type ProjectPageData } from "./project-detail-data";
import type { ProjectDetailRoute } from "./project-detail-routing";
import { projectKeys } from "./project-keys";

/** Loads the data for the current project section and reloads on demand. */
export function useProjectPageData(
  routeState: ProjectDetailRoute,
  isSystemAdmin: boolean,
  locale: Locale,
): LoadedQuery<ProjectPageData> {
  return useLoadedQuery(
    projectKeys.page({ routeState, isSystemAdmin, locale }),
    (signal) =>
      loadProjectPage({
        route: routeState,
        signal: signal,
        isSystemAdmin: isSystemAdmin,
        locale: locale,
      }),
  );
}
