import { expect, test, type Page } from "@playwright/test";

const artifactDigest =
  "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4";
const repositoryPath = `projects/platform/repositories/${encodeURIComponent("platform/gateway")}/artifacts`;
const artifactPath = `${repositoryPath}/${encodeURIComponent(artifactDigest)}`;

const routes = [
  "overview",
  "projects",
  "repositories",
  ...[
    "repositories",
    "members",
    "robots",
    "webhooks",
    "rules",
    "retention",
    "audit",
    "preheat",
    "settings",
  ].map((section) => `projects/platform/${section}`),
  repositoryPath,
  ...[
    "overview",
    "tags",
    "labels",
    "vulnerabilities",
    "sbom",
    "license",
    "files",
    "build",
    "dependencies",
    "readme",
    "values",
    "accessories",
  ].map((tab) => `${artifactPath}?tab=${tab}`),
  ...["overview", "scanners", "vulnerabilities", "exports", "allowlist"].map(
    (section) => `security/${section}`,
  ),
  "registries",
  "replication",
  "preheat",
  "audit",
  ...[
    "users",
    "groups",
    "robots",
    "labels",
    "quotas",
    "maintenance",
    "purge",
    "jobs",
    "configuration",
  ].map((section) => `administration/${section}`),
  "administration/configuration?tab=security",
  "administration/configuration?tab=system",
  "system",
  "about",
] as const;

const scenarios = [
  { locale: "zh-CN", width: 1440, height: 900 },
  { locale: "zh-CN", width: 1280, height: 800 },
  { locale: "zh-CN", width: 390, height: 844 },
  { locale: "zh-CN", width: 360, height: 800 },
  { locale: "en-US", width: 1440, height: 900 },
  { locale: "en-US", width: 1280, height: 800 },
  { locale: "en-US", width: 390, height: 844 },
  { locale: "en-US", width: 360, height: 800 },
] as const;

async function enterDemo(
  page: Page,
  locale: (typeof scenarios)[number]["locale"],
) {
  await page.goto("/");
  await expect(page).toHaveTitle(/Harbor/);
  await page.getByRole("button", { name: "使用演示数据预览" }).click();
  await expect(page).toHaveURL(/#\/overview$/);
  await expect(page.locator("main h1").first()).toBeVisible();

  if (locale === "en-US") {
    await page.getByRole("button", { name: "Switch to English" }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

async function verifyRoute(page: Page, route: string) {
  await page.evaluate((nextRoute) => {
    window.location.hash = `#/${nextRoute}`;
  }, route);
  await expect(page).toHaveURL(
    new RegExp(`#/${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  );
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page.locator("main .loading-state, main .route-loading"),
  ).toHaveCount(0);
  await expect(page.locator("main .error-state")).toHaveCount(0);
  await expect(page.locator("main h1").first()).toBeVisible();

  const overflow = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>("main");
    return {
      document: document.documentElement.scrollWidth - window.innerWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(overflow.document, `${route} document overflow`).toBeLessThanOrEqual(
    1,
  );
  expect(overflow.main, `${route} main overflow`).toBeLessThanOrEqual(1);
}

async function verifySearchFocus(page: Page, locale: string) {
  const searchName = locale === "en-US" ? "Global search" : "全局搜索";
  const opener = page.getByRole("button", { name: searchName });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: searchName });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("searchbox");
  await expect(input).toBeFocused();
  await input.fill("platform");
  await expect(
    dialog.getByText("platform", { exact: true }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
}

test.describe.configure({ mode: "parallel" });

for (const scenario of scenarios) {
  test(`${scenario.locale} ${String(scenario.width)}x${String(scenario.height)} covers every route`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height,
    });
    await enterDemo(page, scenario.locale);

    const browserIssues: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        browserIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) =>
      browserIssues.push(`pageerror: ${error.message}`),
    );
    for (const route of routes) await verifyRoute(page, route);
    await verifySearchFocus(page, scenario.locale);

    expect(browserIssues).toEqual([]);
  });
}
