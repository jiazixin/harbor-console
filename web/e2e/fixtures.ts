import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
} from "@playwright/test";

type DemoStorage = Awaited<ReturnType<BrowserContext["storageState"]>>;
// One read-only demo session per worker keeps this expanded suite inside the
// production login rate limit. Each test still receives an isolated context.
export const test = base.extend<object, { demoStorage: DemoStorage }>({
  demoStorage: [
    async ({ browser }, use, workerInfo) => {
      const context = await browser.newContext({
        baseURL: workerInfo.project.use.baseURL,
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
      });
      try {
        const page = await context.newPage();
        await page.goto("/");
        await page.getByRole("button", { name: "使用演示数据预览" }).click();
        await expect(page).toHaveURL(/#\/overview$/);
        await expect(
          page.getByRole("navigation", { name: /主导航|Main navigation/ }),
        ).toBeVisible();
        await use(await context.storageState());
      } finally {
        await context.close();
      }
    },
    { scope: "worker" },
  ],
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date("2026-10-31T00:00:00.000Z"));
    await use(page);
  },
  storageState: async ({ demoStorage }, use) => {
    await use(demoStorage);
  },
});

export { expect };

const replicationTableNames = {
  policies: /^(复制策略|Replication policies)$/,
  executions: /^(复制执行|Replication executions)$/,
};

/** A replication table by its accessible name in either console locale. */
export function replicationTable(
  page: Page,
  table: keyof typeof replicationTableNames,
) {
  return page.getByRole("table", { name: replicationTableNames[table] });
}
