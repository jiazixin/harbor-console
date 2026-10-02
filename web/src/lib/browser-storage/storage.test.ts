import { afterEach, describe, expect, it, vi } from "vitest";

import { readStoredItem, removeStoredItem, writeStoredItem } from "./storage";

afterEach(() => vi.restoreAllMocks());

describe("optional browser storage", () => {
  it.each(["localStorage", "sessionStorage"] as const)(
    "continues when browser policy blocks access to %s",
    (storage) => {
      vi.spyOn(window, storage, "get").mockImplementation(() => {
        throw new DOMException("Access denied", "SecurityError");
      });
      expect(readStoredItem(storage, "preference")).toBeNull();
      expect(() =>
        writeStoredItem(storage, "preference", "value"),
      ).not.toThrow();
      expect(() => removeStoredItem(storage, "preference")).not.toThrow();
    },
  );

  it("continues when the storage quota rejects a write", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(() =>
      writeStoredItem("localStorage", "preference", "value"),
    ).not.toThrow();
  });
});
