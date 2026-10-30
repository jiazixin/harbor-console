import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { parseConsoleRoute, useConsoleRoute } from "./console-route";

afterEach(() => {
  cleanup();
});

describe("parseConsoleRoute", () => {
  it("keeps the project collection and project detail routes distinct", () => {
    expect(parseConsoleRoute("#/projects")).toMatchObject({
      view: "projects",
      segments: ["projects"],
    });
    const detail = parseConsoleRoute(
      "#/projects/platform/repositories?page=2&sort=-pull_count",
    );
    expect(detail.view).toBe("project");
    expect(detail.segments).toEqual(["projects", "platform", "repositories"]);
    expect(detail.query.get("page")).toBe("2");
    expect(detail.query.get("sort")).toBe("-pull_count");
  });

  it("decodes route segments without failing on malformed encoding", () => {
    expect(
      parseConsoleRoute("#/projects/team%20one/settings").segments,
    ).toEqual(["projects", "team one", "settings"]);
    expect(
      parseConsoleRoute("#/projects/%E0%A4%A/repositories").segments[1],
    ).toBe("%E0%A4%A");
  });

  it("distinguishes repository and artifact routes from project detail", () => {
    const repository = parseConsoleRoute(
      "#/projects/platform/repositories/platform%2Fgateway/artifacts?page=2&scan=success",
    );
    expect(repository).toMatchObject({
      view: "repository",
      segments: [
        "projects",
        "platform",
        "repositories",
        "platform/gateway",
        "artifacts",
      ],
    });
    expect(repository.query.get("scan")).toBe("success");

    expect(
      parseConsoleRoute(
        "#/projects/platform/repositories/platform%2Fgateway/artifacts/sha256%3Aabc?tab=tags",
      ),
    ).toMatchObject({
      view: "artifact",
      segments: [
        "projects",
        "platform",
        "repositories",
        "platform/gateway",
        "artifacts",
        "sha256:abc",
      ],
    });
  });
});

describe("useConsoleRoute", () => {
  it("keeps the route stable through unrelated renders and updates on navigation", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={["/security/scanners?filter=trivy"]}>
        {children}
      </MemoryRouter>
    );
    const { result, rerender } = renderHook(useConsoleRoute, { wrapper });
    const initialRoute = result.current.route;
    expect(initialRoute.view).toBe("security");
    expect(initialRoute.query.get("filter")).toBe("trivy");
    rerender();
    expect(result.current.route).toBe(initialRoute);
    expect(result.current.route.query).toBe(initialRoute.query);

    act(() => {
      result.current.navigate("projects");
    });
    expect(result.current.route).not.toBe(initialRoute);
    expect(result.current.route.view).toBe("projects");
  });

  it("keeps encoded slashes inside one segment", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    );
    const { result } = renderHook(useConsoleRoute, { wrapper });
    act(() => {
      result.current.navigate(
        "projects/platform/repositories/platform%2Fgateway/artifacts",
      );
    });
    expect(result.current.route.view).toBe("repository");
    expect(result.current.route.segments[3]).toBe("platform/gateway");
  });
});
