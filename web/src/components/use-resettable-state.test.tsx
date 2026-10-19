import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useResettableState } from "./use-resettable-state";

describe("useResettableState", () => {
  it("keeps an edit made right after mounting", () => {
    const { result } = renderHook(({ source }) => useResettableState(source), {
      initialProps: { source: "" },
    });
    act(() => result.current[1]("release"));
    expect(result.current[0]).toBe("release");
  });

  it("resets to the new source when the source changes", () => {
    const { result, rerender } = renderHook(
      ({ source }) => useResettableState(source),
      { initialProps: { source: "alpha" } },
    );
    act(() => result.current[1]("draft"));
    rerender({ source: "alpha" });
    expect(result.current[0]).toBe("draft");
    rerender({ source: "beta" });
    expect(result.current[0]).toBe("beta");
  });
});
