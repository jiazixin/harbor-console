import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { parseHashRoute, useHashRouter } from "./hash-router";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", window.location.pathname);
});

describe("parseHashRoute", () => {
  it("keeps the project collection and project detail routes distinct", () => {
    expect(parseHashRoute("#/projects")).toMatchObject({
      view: "projects",
      segments: ["projects"],
    });
    const detail = parseHashRoute(
      "#/projects/platform/repositories?page=2&sort=-pull_count",
    );
    expect(detail.view).toBe("project");
    expect(detail.segments).toEqual(["projects", "platform", "repositories"]);
    expect(detail.query.get("page")).toBe("2");
    expect(detail.query.get("sort")).toBe("-pull_count");
  });

  it("decodes route segments without failing on malformed encoding", () => {
    expect(parseHashRoute("#/projects/team%20one/settings").segments).toEqual([
      "projects",
      "team one",
      "settings",
    ]);
    expect(parseHashRoute("#/projects/%E0%A4%A/repositories").segments[1]).toBe(
      "%E0%A4%A",
    );
  });

  it("distinguishes repository and artifact routes from project detail", () => {
    const repository = parseHashRoute(
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
      parseHashRoute(
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

describe("useHashRouter", () => {
  it("keeps the route stable through unrelated renders and updates on navigation", () => {
    window.location.hash = "#/security/scanners?filter=trivy";
    const { result, rerender } = renderHook(useHashRouter);
    const initialRoute = result.current.route;
    rerender();
    expect(result.current.route).toBe(initialRoute);
    expect(result.current.route.query).toBe(initialRoute.query);

    act(() => {
      result.current.navigate("projects");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current.route).not.toBe(initialRoute);
    expect(result.current.route.view).toBe("projects");
  });
});
