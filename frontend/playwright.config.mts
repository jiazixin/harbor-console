import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const port = Number.parseInt(process.env.HARBOR_E2E_PORT ?? "18484", 10);
const externalBaseURL = process.env.HARBOR_E2E_BASE_URL;
const baseURL = externalBaseURL ?? `http://127.0.0.1:${String(port)}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: join(tmpdir(), "harbor-console-playwright"),
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: process.env.CI ? 3 : undefined,
  reporter: "line",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "go run ./cmd/harbor-console",
        cwd: repositoryRoot,
        env: {
          ...process.env,
          ACCESS_LOG: "false",
          LISTEN: "127.0.0.1",
          PORT: String(port),
        },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: `${baseURL}/health`,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
