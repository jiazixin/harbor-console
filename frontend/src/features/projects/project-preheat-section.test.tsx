import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../app/locale-context";
import { IconSprite } from "../../components/icons";
import { ProjectPreheatSection } from "./project-preheat-section";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("ProjectPreheatSection", () => {
  it("renders the legacy policy table and routes row actions", () => {
    const onAction = vi.fn();
    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectPreheatSection
          project="platform"
          projectId={1}
          providers={[{ id: 61, provider: "dragonfly", default: true }]}
          policies={[
            {
              id: 81,
              name: "release-images",
              description: "预热平台发布镜像",
              provider_id: 61,
              filters:
                '[{"type":"repository","value":"**"},{"type":"tag","value":"release-*"}]',
              trigger:
                '{"type":"scheduled","trigger_setting":{"cron":"0 0 2 * * *"}}',
              enabled: true,
              update_time: "2026-07-28T02:00:00Z",
            },
          ]}
          pagination={{ page: 1, page_size: 50, total: 1 }}
          initialQuery=""
          errors={[]}
          onSearch={vi.fn()}
          onPageChange={vi.fn()}
          onAction={onAction}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText("release-images")).toBeInTheDocument();
    expect(screen.getByText("release-*")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "立即预热" }));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "run", project: "platform" }),
    );
  });
});
