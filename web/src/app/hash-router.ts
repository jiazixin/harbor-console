import { useCallback, useMemo, useSyncExternalStore } from "react";

export type ConsoleRoute = {
  view: string;
  path: string;
  segments: string[];
  query: URLSearchParams;
};

function routeSnapshot(): string {
  return window.location.hash || "#/overview";
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export function parseHashRoute(hash: string): ConsoleRoute {
  const source = hash.replace(/^#\/?/, "");
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
    view =
      artifactIndex === -1
        ? "project"
        : segments.length > artifactIndex + 1
          ? "artifact"
          : "repository";
  }
  return {
    view,
    path,
    segments,
    query: new URLSearchParams(queryPart),
  };
}

export function useHashRouter(): {
  route: ConsoleRoute;
  navigate: (path: string) => void;
} {
  const hash = useSyncExternalStore(
    subscribe,
    routeSnapshot,
    () => "#/overview",
  );
  const navigate = useCallback((path: string) => {
    window.location.hash = `#/${path.replace(/^\/?/, "")}`;
  }, []);
  const route = useMemo(() => parseHashRoute(hash), [hash]);
  return { route, navigate };
}
