import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

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
  await page.goto("/#/overview");
  await expect(page).toHaveTitle(/Harbor/);
  await expect(page.locator(".app-shell")).toBeVisible();
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

async function verifyPaginationSelectPlacement(page: Page, locale: string) {
  await verifyRoute(page, "repositories");
  const label = locale === "en-US" ? "Items per page" : "每页条数";
  const trigger = page.getByRole("button", { name: label });
  await trigger.evaluate((element) =>
    element.scrollIntoView({ block: "end", inline: "nearest" }),
  );
  await trigger.click();
  const menu = page.getByRole("listbox", { name: label });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("data-placement", "top");

  const bounds = await menu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const left = viewport?.offsetLeft ?? 0;
    const width = viewport?.width ?? document.documentElement.clientWidth;
    const height = viewport?.height ?? document.documentElement.clientHeight;
    return {
      top: rect.top - top,
      right: left + width - rect.right,
      bottom: top + height - rect.bottom,
      left: rect.left - left,
    };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(7);
  expect(bounds.right).toBeGreaterThanOrEqual(7);
  expect(bounds.bottom).toBeGreaterThanOrEqual(7);
  expect(bounds.left).toBeGreaterThanOrEqual(7);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
}

async function verifyCenteredColumn(
  page: Page,
  tableSelector: string,
  column: number,
) {
  const metrics = await page.locator(tableSelector).evaluate((table, index) => {
    const header = table.querySelector<HTMLElement>(
      `thead th:nth-child(${String(index)})`,
    );
    const label = header?.querySelector<HTMLElement>(
      ".table-sort-button > span:first-child",
    );
    const cell = table.querySelector<HTMLElement>(
      `tbody tr:first-child td:nth-child(${String(index)})`,
    );
    const child = cell?.firstElementChild;
    const headerRect = header?.getBoundingClientRect();
    const labelRect = label?.getBoundingClientRect();
    const cellRect = cell?.getBoundingClientRect();
    const headerStyle = header ? window.getComputedStyle(header) : undefined;
    const cellStyle = cell ? window.getComputedStyle(cell) : undefined;
    const sortButton = header?.querySelector<HTMLElement>(".table-sort-button");
    let contentRect = child?.getBoundingClientRect();
    if (!contentRect && cell) {
      const range = document.createRange();
      range.selectNodeContents(cell);
      contentRect = range.getBoundingClientRect();
    }
    if (!headerRect || !labelRect || !cellRect || !contentRect) return null;
    return {
      headerDelta:
        labelRect.left +
        labelRect.width / 2 -
        (headerRect.left + headerRect.width / 2),
      cellDelta:
        contentRect.left +
        contentRect.width / 2 -
        (cellRect.left + cellRect.width / 2),
      crossDelta:
        labelRect.left +
        labelRect.width / 2 -
        (contentRect.left + contentRect.width / 2),
      headerOverflow:
        (sortButton?.scrollWidth ?? 0) -
        (headerRect.width -
          Number.parseFloat(headerStyle?.paddingLeft ?? "0") -
          Number.parseFloat(headerStyle?.paddingRight ?? "0")),
      cellOverflow:
        contentRect.width -
        (cellRect.width -
          Number.parseFloat(cellStyle?.paddingLeft ?? "0") -
          Number.parseFloat(cellStyle?.paddingRight ?? "0")),
    };
  }, column);
  expect(metrics).not.toBeNull();
  const context = `${tableSelector} column ${String(column)}`;
  expect(
    Math.abs(metrics?.headerDelta ?? Infinity),
    context,
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(metrics?.cellDelta ?? Infinity), context).toBeLessThanOrEqual(
    1,
  );
  expect(
    Math.abs(metrics?.crossDelta ?? Infinity),
    context,
  ).toBeLessThanOrEqual(1);
  expect(metrics?.headerOverflow ?? Infinity, context).toBeLessThanOrEqual(1);
  expect(metrics?.cellOverflow ?? Infinity, context).toBeLessThanOrEqual(1);
}

async function verifySemanticColumnPairing(page: Page, tableSelector: string) {
  const violations = await page.locator(tableSelector).evaluate((table) => {
    const semanticClasses = [
      "table-cell-center",
      "table-cell-number",
      "table-cell-time",
    ];
    const headerCells = Array.from(
      table.querySelectorAll<HTMLElement>("thead tr:last-child > th"),
    );
    const firstBodyRow = table.querySelector("tbody tr");
    if (!firstBodyRow) return [];
    const bodyCells = Array.from(
      firstBodyRow.querySelectorAll<HTMLElement>(":scope > td"),
    );
    return headerCells.flatMap((header, index) => {
      if (index >= bodyCells.length) return [];
      const body = bodyCells[index];
      const headerSemantic = semanticClasses.find((name) =>
        header.classList.contains(name),
      );
      const bodySemantic = semanticClasses.find((name) =>
        body.classList.contains(name),
      );
      return headerSemantic && headerSemantic !== bodySemantic
        ? [{ index: index + 1, headerSemantic, bodySemantic }]
        : [];
    });
  });
  expect(violations, `${tableSelector} header/body semantic alignment`).toEqual(
    [],
  );
}

async function verifyReplicationColumnAlignment(page: Page) {
  await verifyRoute(page, "replication");
  for (const column of [2, 4, 5]) {
    await verifyCenteredColumn(page, ".replication-policy-table", column);
  }
  await verifyRoute(page, "replication?tab=executions");
  for (const column of [3, 4, 5, 6, 7]) {
    await verifyCenteredColumn(page, ".replication-execution-table", column);
  }
}

async function verifyProjectsColumnAlignment(page: Page) {
  await verifyRoute(page, "projects");
  await verifySemanticColumnPairing(page, ".project-select-table");
  const identityColumns = await page
    .locator(".project-select-table")
    .evaluate((table) =>
      Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr")).map(
        (row) => {
          const identity = row.cells[1];
          const visibility = row.cells[2].querySelector<HTMLElement>(".badge");
          const name = identity.querySelector<HTMLElement>("strong");
          if (!name || !visibility) return null;
          const identityStyle = getComputedStyle(identity);
          const identityRect = identity.getBoundingClientRect();
          return {
            name: name.textContent,
            contentWidth:
              identityRect.width -
              Number.parseFloat(identityStyle.paddingLeft) -
              Number.parseFloat(identityStyle.paddingRight),
            nameRight: name.getBoundingClientRect().right,
            visibilityLeft: visibility.getBoundingClientRect().left,
          };
        },
      ),
    );
  expect(identityColumns.length).toBeGreaterThan(0);
  for (const column of identityColumns) {
    expect(column).not.toBeNull();
    expect(
      column?.contentWidth ?? 0,
      `${column?.name ?? "project"} identity width`,
    ).toBeGreaterThanOrEqual(180);
    expect(
      column?.nameRight ?? Infinity,
      `${column?.name ?? "project"} name/visibility separation`,
    ).toBeLessThanOrEqual((column?.visibilityLeft ?? 0) - 8);
  }
  for (const column of [3, 5, 6]) {
    await verifyCenteredColumn(page, ".project-select-table", column);
  }
}

for (const locale of ["zh-CN", "en-US"] as const) {
  test(`${locale} project table remains usable at an effective 200% zoom viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 720, height: 450 });
    await enterDemo(page, locale);
    await verifyProjectsColumnAlignment(page);
    const scroll = page.locator(".project-select-table").locator("..");
    const tableWidth = await scroll.evaluate((element) => ({
      content: element.scrollWidth,
      viewport: element.clientWidth,
    }));
    expect(tableWidth.content).toBeGreaterThan(tableWidth.viewport);
  });
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
    const browserIssues: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        browserIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) =>
      browserIssues.push(`pageerror: ${error.message}`),
    );
    await enterDemo(page, scenario.locale);
    for (const route of routes) await verifyRoute(page, route);
    await verifyPaginationSelectPlacement(page, scenario.locale);
    await verifyProjectsColumnAlignment(page);
    await verifyReplicationColumnAlignment(page);
    await verifySearchFocus(page, scenario.locale);

    expect(browserIssues).toEqual([]);
  });
}
