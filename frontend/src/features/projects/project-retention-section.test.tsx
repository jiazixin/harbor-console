import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../app/locale-context";
import type { RetentionMetadata, RetentionPolicy } from "../../app/models";
import { IconSprite } from "../../components/icons";
import { ProjectRetentionSection } from "./project-retention-section";

const metadata: RetentionMetadata = {
  templates: [
    {
      rule_template: "latestPushedK",
      display_text: "保留最近推送的制品",
    },
  ],
  scope_selectors: [
    { kind: "doublestar", decorations: ["repoMatches", "repoExcludes"] },
  ],
  tag_selectors: [{ kind: "doublestar", decorations: ["matches", "excludes"] }],
};

const duplicateIdPolicy: RetentionPolicy = {
  id: 31,
  algorithm: "or",
  rules: [
    {
      id: 1,
      priority: 1,
      action: "retain",
      template: "latestPushedK",
      params: { latestPushedK: 10 },
      tag_selectors: [
        { kind: "doublestar", decoration: "matches", pattern: "stable-*" },
      ],
      scope_selectors: {
        repository: [
          { kind: "doublestar", decoration: "repoMatches", pattern: "app/**" },
        ],
      },
    },
    {
      id: 1,
      priority: 2,
      action: "retain",
      template: "latestPushedK",
      params: { latestPushedK: 5 },
      tag_selectors: [
        { kind: "doublestar", decoration: "matches", pattern: "release-*" },
      ],
      scope_selectors: {
        repository: [
          { kind: "doublestar", decoration: "repoMatches", pattern: "api/**" },
        ],
      },
    },
  ],
  trigger: { kind: "Schedule", settings: { cron: "0 0 2 * * *" } },
  scope: { level: "project", ref: 1 },
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("ProjectRetentionSection", () => {
  it("renders duplicate Harbor rule ids without React key warnings", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectRetentionSection
          project="platform"
          projectId={1}
          policy={duplicateIdPolicy}
          executions={[]}
          pagination={{ page: 1, page_size: 20, total: 0 }}
          metadata={metadata}
          onPageChange={vi.fn()}
          onAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText("app/**")).toBeInTheDocument();
    expect(screen.getByText("api/**")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("same key"),
      expect.anything(),
    );
  });

  it("constrains boundary selectors while preserving their complete value", () => {
    const selector = "acceptance-boundary-*" + "x".repeat(1003);
    const policy: RetentionPolicy = {
      ...duplicateIdPolicy,
      rules: [
        {
          ...duplicateIdPolicy.rules?.[0],
          scope_selectors: {
            repository: [
              {
                kind: "doublestar",
                decoration: "repoMatches",
                pattern: selector,
              },
            ],
          },
          tag_selectors: [
            {
              kind: "doublestar",
              decoration: "matches",
              pattern: selector,
            },
          ],
        },
      ],
    };

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectRetentionSection
          project="platform"
          projectId={1}
          policy={policy}
          executions={[]}
          pagination={{ page: 1, page_size: 20, total: 0 }}
          metadata={metadata}
          onPageChange={vi.fn()}
          onAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(screen.getAllByText(selector)).toHaveLength(2);
    screen
      .getAllByText(selector)
      .forEach((element) => expect(element).toHaveAttribute("title", selector));
  });
});
