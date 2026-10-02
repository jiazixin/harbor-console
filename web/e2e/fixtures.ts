import { expect, test as base, type BrowserContext } from "@playwright/test";

type DemoStorage = Awaited<ReturnType<BrowserContext["storageState"]>>;
// One read-only demo session per worker keeps this expanded suite inside the
// production login rate limit. Each test still receives an isolated context.
export const test = base.extend<object, { demoStorage: DemoStorage }>({
  demoStorage: [
    async ({ browser }, use, workerInfo) => {
      const context = await browser.newContext({
        baseURL: workerInfo.project.use.baseURL,
      });
      try {
        const page = await context.newPage();
        await page.goto("/");
        await page.getByRole("button", { name: "使用演示数据预览" }).click();
        await expect(page).toHaveURL(/#\/overview$/);
        await expect(page.locator(".app-shell")).toBeVisible();
        await use(await context.storageState());
      } finally {
        await context.close();
      }
    },
    { scope: "worker" },
  ],
  storageState: async ({ demoStorage }, use) => {
    await use(demoStorage);
  },
});

export { expect };
