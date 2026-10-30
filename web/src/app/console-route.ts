import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";

export type ConsoleRoute = {
  view: string;
  path: string;
  segments: string[];
  query: URLSearchParams;
};

/** Parses a console location such as "/projects/a?page=2"; a leading "#" is allowed. */
export function parseConsoleRoute(location: string): ConsoleRoute {
  const source = location.replace(/^#?\/?/, "");
  const [pathPart = "overview", queryPart = ""] = source.split("?", 2);
  const path = pathPart || "overview";
  const segments = path
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  let view = segments[0] || "overview";
  if (segments[0] === "projects" && segments.length > 1) {
    const artifactIndex =
      segments[2] === "repositories" && segments[4] === "artifacts" ? 4 : -1;
    view = (() => {
      if (artifactIndex === -1) {
        return "project";
      }
      if (segments.length > artifactIndex + 1) {
        return "artifact";
      }
      return "repository";
    })();
  }
  return {
    view,
    path,
    segments,
    query: new URLSearchParams(queryPart),
  };
}

/** The current console route and navigation, read from React Router. */
export function useConsoleRoute(): {
  route: ConsoleRoute;
  navigate: (path: string) => void;
} {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const navigate = useCallback(
    (path: string) => void routerNavigate(`/${path.replace(/^\/?/, "")}`),
    [routerNavigate],
  );
  // Consumers include this object in effect dependencies; unrelated renders must keep it stable.
  const route = useMemo(
    () => parseConsoleRoute(location.pathname + location.search),
    [location.pathname, location.search],
  );
  return { route, navigate };
}
