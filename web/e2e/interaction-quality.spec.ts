import type { Page } from "@playwright/test";
import { expect, replicationTable, test } from "./fixtures";

async function enterDemo(page: Page) {
  await page.goto("/#/overview");
  await expect(
    page.getByRole("navigation", { name: /主导航|Main navigation/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function navigate(page: Page, route: string) {
  await page.evaluate((value) => {
    location.hash = `#/${value}`;
  }, route);
  await expect(
    page.locator(
      "main .hc_8b938f52_loadingState, main .hc_8b938f52_routeLoading",
    ),
  ).toHaveCount(0);
}

test("modal keeps keyboard focus, handles portaled selects and restores its opener", async ({
  page,
}) => {
  await enterDemo(page);
  await navigate(page, "projects");
  const opener = page.getByRole("button", { name: "新建项目", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "新建项目" });
  await expect(dialog.getByRole("textbox").first()).toBeFocused();
  const close = dialog.getByRole("button", { name: "关闭", exact: true });
  const submit = dialog.getByRole("button", { name: "创建项目", exact: true });
  await submit.focus();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(submit).toBeFocused();
  const select = dialog.getByRole("button", {
    name: "项目配额单位",
    exact: true,
  });
  await select.focus();
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("listbox");
  await expect(menu).toBeVisible();
  await expect(menu.locator('[aria-selected="true"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(select).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator("html")).not.toHaveClass(/overlayOpen/);
});

test("global search wraps keyboard focus across dynamic results", async ({
  page,
}) => {
  await enterDemo(page);
  const opener = page.getByRole("button", { name: "全局搜索" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "全局搜索" });
  const search = dialog.getByRole("searchbox");
  await search.fill("platform");
  await expect(
    dialog
      .getByRole("button")
      .filter({ has: page.locator("strong") })
      .first(),
  ).toBeVisible();
  await dialog
    .getByRole("button")
    .filter({ has: page.locator("strong") })
    .last()
    .focus();
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog
      .getByRole("button")
      .filter({ has: page.locator("strong") })
      .last(),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
});

test("tab motion preserves page identity; reduced motion disables all animation", async ({
  page,
}) => {
  await enterDemo(page);
  await navigate(page, "replication");
  await expect(replicationTable(page, "policies")).toBeVisible();
  await page.locator("main .hc_8b938f52_pageHeader").evaluate((element) => {
    element.setAttribute("data-stable-header", "true");
  });
  await page.locator("main .content-transition").evaluate((element) => {
    element.setAttribute("data-stable-content", "true");
  });
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--motion-standard", "1500ms");
  });
  await page.getByRole("link", { name: "执行记录", exact: true }).click();
  await expect(replicationTable(page, "executions")).toBeVisible();
  await expect(page.locator('[data-stable-header="true"]')).toHaveCount(1);
  await expect(page.locator('[data-stable-content="true"]')).toHaveCount(1);
  expect(
    await page
      .locator("main .content-transition")
      .evaluate((element) => element.getAnimations().length),
  ).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page
        .locator("main .content-transition")
        .evaluate((element) => element.getAnimations().length),
    )
    .toBe(0);
  await page.getByRole("link", { name: "复制策略", exact: true }).click();
  await expect(replicationTable(page, "policies")).toBeVisible();
  expect(
    await page
      .locator("main")
      .evaluate((element) => element.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await navigate(page, "projects");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("项目中心");
  expect(
    await page
      .locator("main")
      .evaluate((element) => element.getAnimations({ subtree: true }).length),
  ).toBe(0);
});

test("refresh feedback follows request lifetime without replaying route motion", async ({
  page,
}) => {
  await enterDemo(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const refresh = page.locator("main .hc_8b938f52_refreshButton");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/dashboards/current", async (route) => {
    await gate;
    await route.continue();
  });
  await page
    .locator("main .hc_9a652fa2_motionRouteEnter")
    .evaluate((element) => {
      element.setAttribute("data-stable-route", "true");
    });
  await refresh.click();
  await expect(refresh).toHaveAttribute("aria-busy", "true");
  expect(
    await refresh
      .locator(".hc_8b938f52_icon")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("motion-spin");
  release();
  await expect(refresh).toHaveAttribute("aria-busy", "false");
  await expect(page.locator('[data-stable-route="true"]')).toHaveCount(1);
  expect(
    await refresh
      .locator(".hc_8b938f52_icon")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
});

for (const locale of ["zh-CN", "en-US"]) {
  test(`${locale} dark mobile layout and dialog stay inside the viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterDemo(page);
    await page.getByRole("button", { name: "切换主题" }).click();
    if (locale === "en-US")
      await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    for (const route of [
      "overview",
      "projects",
      "repositories",
      "registries",
      "replication?tab=executions",
      "security/overview",
      "administration/configuration",
    ]) {
      await navigate(page, route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
        route,
      ).toBeLessThanOrEqual(1);
    }
    await navigate(page, "projects");
    const createProject = locale === "en-US" ? "New project" : "新建项目";
    await page
      .getByRole("button", { name: createProject, exact: true })
      .click();
    // Match by name: while the dialog module downloads, a placeholder dialog
    // is shown and then replaced, so an unnamed locator can measure it.
    const dialog = page.getByRole("dialog", {
      name: createProject,
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("footer")).toBeInViewport();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? Infinity)).toBeLessThanOrEqual(
      390,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
}
