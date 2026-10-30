import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function expectNoSeriousViolations(page: Page, where: string) {
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations
      .filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      )
      .map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map(
          (node) => `${node.target.join(" ")}: ${node.failureSummary ?? ""}`,
        ),
      })),
    where,
  ).toEqual([]);
}

const artifactDigest =
  "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4";
const repositoryPath = `projects/platform/repositories/${encodeURIComponent("platform/gateway")}/artifacts`;

const routes = [
  "overview",
  "projects",
  "repositories",
  "projects/platform/repositories",
  "projects/platform/members",
  repositoryPath,
  `${repositoryPath}/${encodeURIComponent(artifactDigest)}?tab=overview`,
  "security/overview",
  "security/vulnerabilities",
  "registries",
  "replication",
  "preheat",
  "audit",
  "administration/users",
  "administration/configuration",
  "system",
  "about",
];

for (const colorScheme of ["light", "dark"] as const) {
  test(`${colorScheme} console pages have no serious accessibility violations`, async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "axe results do not depend on the engine",
    );
    // Audit settled pages, not colors halfway through a route transition.
    await page.emulateMedia({ reducedMotion: "reduce" });
    // The console keeps its own theme choice rather than following the system.
    await page.addInitScript((theme) => {
      localStorage.setItem("harbor-console-theme", theme);
    }, colorScheme);
    await page.goto("/#/overview");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      colorScheme,
    );
    await expect(
      page.getByRole("navigation", { name: /主导航|Main navigation/ }),
    ).toBeVisible();
    for (const route of routes) {
      await page.evaluate((next) => {
        window.location.hash = `#/${next}`;
      }, route);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();
      await expect(
        page.locator(
          "main .hc_8b938f52_loadingState, main .hc_8b938f52_routeLoading",
        ),
      ).toHaveCount(0);
      await expectNoSeriousViolations(page, route);
    }
  });
}
