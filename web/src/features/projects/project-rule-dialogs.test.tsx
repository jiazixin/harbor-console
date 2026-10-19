import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { LocaleProvider } from "../../app/locale-context";
import type {
  ImmutableTagRule,
  ProjectLabel,
  RetentionMetadata,
} from "../../app/models";
import { IconSprite } from "../../components/icons";
import {
  DeleteImmutableTagRuleDialog,
  DeleteProjectLabelDialog,
  ImmutableTagRuleDialog,
  ProjectLabelDialog,
} from "./project-rule-dialogs";

const metadata: RetentionMetadata = {
  scope_selectors: [
    { kind: "doublestar", decorations: ["repoMatches", "repoExcludes"] },
  ],
  tag_selectors: [{ kind: "doublestar", decorations: ["matches", "excludes"] }],
};

const rule: ImmutableTagRule = {
  id: 31,
  priority: 4,
  disabled: false,
  action: "immutable",
  template: "immutable_template",
  params: {},
  scope_selectors: {
    repository: [
      {
        kind: "doublestar",
        decoration: "repoMatches",
        pattern: "release/**",
      },
    ],
  },
  tag_selectors: [
    {
      kind: "doublestar",
      decoration: "matches",
      pattern: "v*",
    },
  ],
};

const label: ProjectLabel = {
  id: 42,
  name: "候选",
  description: "待发布验证",
  color: "#e8a317",
  scope: "p",
  project_id: 1,
};

function renderDialog(content: React.ReactNode) {
  return render(
    <LocaleProvider>
      <IconSprite />
      {content}
    </LocaleProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("project rule dialogs", () => {
  it("creates an immutable rule with the minimal Harbor payload", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onSaved = vi.fn();

    renderDialog(
      <ImmutableTagRuleDialog
        project="platform"
        metadata={metadata}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "仓库匹配" }), {
      target: { value: " platform/** " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Tag 匹配" }), {
      target: { value: " release-* " },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建规则" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "immutable-rules",
      { project: "platform" },
      "POST",
      {
        disabled: false,
        action: "immutable",
        template: "immutable_template",
        params: {},
        tag_selectors: [
          {
            kind: "doublestar",
            decoration: "matches",
            pattern: "release-*",
          },
        ],
        scope_selectors: {
          repository: [
            {
              kind: "doublestar",
              decoration: "repoMatches",
              pattern: "platform/**",
            },
          ],
        },
      },
    );
  });

  it("updates editable immutable rule fields without response IDs", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onSaved = vi.fn();

    renderDialog(
      <ImmutableTagRuleDialog
        project="platform"
        rule={rule}
        metadata={metadata}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /暂时停用规则/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tag 条件" }));
    fireEvent.click(screen.getByRole("option", { name: "排除" }));
    fireEvent.click(screen.getByRole("button", { name: "保存规则" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "immutable-rule",
      { project: "platform", id: 31 },
      "PUT",
      {
        priority: 4,
        disabled: true,
        action: "immutable",
        template: "immutable_template",
        params: {},
        tag_selectors: [
          {
            kind: "doublestar",
            decoration: "excludes",
            pattern: "v*",
          },
        ],
        scope_selectors: {
          repository: [
            {
              kind: "doublestar",
              decoration: "repoMatches",
              pattern: "release/**",
            },
          ],
        },
      },
    );
  });

  it("deletes an immutable rule by project and ID", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    renderDialog(
      <DeleteImmutableTagRuleDialog
        project="platform"
        rule={rule}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除规则" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "immutable-rule",
      { project: "platform", id: 31 },
      "DELETE",
    );
  });

  it("creates and updates project labels with exact payloads", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const created = vi.fn();

    const view = renderDialog(
      <ProjectLabelDialog
        project="platform"
        projectId={1}
        onClose={vi.fn()}
        onSaved={created}
      />,
    );
    const labelName = screen.getByRole("textbox", { name: "标签名称" });
    expect(labelName).toHaveAttribute("maxlength", "128");
    fireEvent.change(labelName, {
      target: { value: " release " },
    });
    fireEvent.change(screen.getByLabelText("标签颜色"), {
      target: { value: "#168352" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "描述" }), {
      target: { value: " Release approved " },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建标签" }));

    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(mutation).toHaveBeenLastCalledWith("labels", {}, "POST", {
      name: "release",
      description: "Release approved",
      color: "#168352",
      scope: "p",
      project_id: 1,
    });

    view.unmount();
    const updated = vi.fn();
    renderDialog(
      <ProjectLabelDialog
        project="platform"
        projectId={1}
        label={label}
        onClose={vi.fn()}
        onSaved={updated}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "描述" }), {
      target: { value: " Ready for verification " },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存标签" }));

    await waitFor(() => expect(updated).toHaveBeenCalled());
    expect(mutation).toHaveBeenLastCalledWith("label", { id: 42 }, "PUT", {
      name: "候选",
      description: "Ready for verification",
      color: "#e8a317",
      scope: "p",
      project_id: 1,
    });
  });

  it("deletes a project label by ID", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    renderDialog(
      <DeleteProjectLabelDialog
        label={label}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除标签" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith("label", { id: 42 }, "DELETE");
  });
});
