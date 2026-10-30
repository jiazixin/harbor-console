import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import type {
  ImmutableTagRule,
  ProjectLabel,
  RetentionMetadata,
} from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { DeleteImmutableTagRuleDialog } from "./delete-immutable-tag-rule-dialog";
import { DeleteProjectLabelDialog } from "./delete-project-label-dialog";
import { ImmutableTagRuleDialog } from "./immutable-tag-rule-dialog";
import { ProjectLabelDialog } from "./project-label-dialog";

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
    <TestProviders>
      <IconSprite />
      {content}
    </TestProviders>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("project rule dialogs", () => {
  it("creates an immutable rule with the minimal Harbor payload", async () => {
    const user = setupUser();
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

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "仓库匹配" }),
      " platform/** ",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "Tag 匹配" }),
      " release-* ",
    );
    await user.click(screen.getByRole("button", { name: "创建规则" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "immutable-rules",
      parameters: { project: "platform" },
      method: "POST",
      payload: {
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
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
  });

  it("updates editable immutable rule fields without response IDs", async () => {
    const user = setupUser();
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

    await user.click(screen.getByRole("checkbox", { name: /暂时停用规则/ }));
    await user.click(screen.getByRole("button", { name: "Tag 条件" }));
    await user.click(screen.getByRole("option", { name: "排除" }));
    await user.click(screen.getByRole("button", { name: "保存规则" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "immutable-rule",
      parameters: { project: "platform", id: 31 },
      method: "PUT",
      payload: {
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
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("deletes an immutable rule by project and ID", async () => {
    const user = setupUser();
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
    await user.click(screen.getByRole("button", { name: "删除规则" }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "immutable-rule",
      parameters: { project: "platform", id: 31 },
      method: "DELETE",
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("creates and updates project labels with exact payloads", async () => {
    const user = setupUser();
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
    await replaceText(user, labelName, " release ");
    await replaceText(user, screen.getByLabelText("标签颜色"), "#168352");
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "描述" }),
      " Release approved ",
    );
    await user.click(screen.getByRole("button", { name: "创建标签" }));

    await waitFor(() => {
      expect(created).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenLastCalledWith({
      operation: "labels",
      parameters: {},
      method: "POST",
      payload: {
        name: "release",
        description: "Release approved",
        color: "#168352",
        scope: "p",
        project_id: 1,
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
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
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "描述" }),
      " Ready for verification ",
    );
    await user.click(screen.getByRole("button", { name: "保存标签" }));

    await waitFor(() => {
      expect(updated).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenLastCalledWith({
      operation: "label",
      parameters: { id: 42 },
      method: "PUT",
      payload: {
        name: "候选",
        description: "Ready for verification",
        color: "#e8a317",
        scope: "p",
        project_id: 1,
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("deletes a project label by ID", async () => {
    const user = setupUser();
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
    await user.click(screen.getByRole("button", { name: "删除标签" }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "label",
      parameters: { id: 42 },
      method: "DELETE",
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });
});
