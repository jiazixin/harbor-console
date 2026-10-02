import { afterEach, describe, expect, it } from "vitest";

import { loadPreferences, savePreferences } from "./preferences";

afterEach(() => window.localStorage.clear());

describe("console preferences", () => {
  it.each(["null", "[]", "true", '"docker"', "{broken"])(
    "uses defaults for an invalid persisted value: %s",
    (stored) => {
      window.localStorage.setItem("harbor-console-preferences-v1", stored);
      expect(loadPreferences()).toEqual({
        dateTimezone: "local",
        registryView: "list",
        repositoryView: "list",
        runtime: "docker",
      });
    },
  );

  it("retains valid preferences and ignores unsupported values", () => {
    window.localStorage.setItem(
      "harbor-console-preferences-v1",
      JSON.stringify({
        dateTimezone: "utc",
        registryView: "card",
        runtime: "sh",
      }),
    );
    const preferences = loadPreferences();
    expect(preferences).toEqual({
      dateTimezone: "utc",
      registryView: "card",
      repositoryView: "list",
      runtime: "docker",
    });
    savePreferences({ ...preferences, runtime: "podman" });
    expect(loadPreferences().runtime).toBe("podman");
  });
});
