import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LocaleProvider } from "../app/locale-context";
import { HarborAnnouncement, parseAnnouncement } from "./harbor-announcement";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("Harbor announcement", () => {
  it("parses Harbor banner messages and respects the display window", () => {
    const now = new Date("2026-10-19T12:00:00");
    const banner = (window: object) =>
      JSON.stringify({ message: "维护通知", type: "info", ...window });
    expect(parseAnnouncement(banner({}), now)).toEqual({
      message: "维护通知",
      type: "info",
      closable: false,
    });
    expect(parseAnnouncement(banner({ fromDate: "2026-10-20" }), now)).toBe(
      null,
    );
    expect(parseAnnouncement(banner({ toDate: "2026-10-18" }), now)).toBe(null);
    expect(parseAnnouncement(banner({ toDate: "2026-10-19" }), now)).not.toBe(
      null,
    );
    expect(parseAnnouncement("not json", now)).toBe(null);
    expect(parseAnnouncement(JSON.stringify({ message: " " }), now)).toBe(null);
  });

  it("renders a closable announcement and remembers the dismissal", () => {
    const raw = JSON.stringify({
      message: "今晚 22:00 维护",
      type: "danger",
      closable: true,
    });
    render(
      <LocaleProvider>
        <HarborAnnouncement rawValue={raw} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("今晚 22:00 维护");
    fireEvent.click(screen.getByRole("button", { name: "关闭公告" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      window.sessionStorage.getItem("harbor-console-dismissed-announcement"),
    ).toBe(raw);
  });
});
