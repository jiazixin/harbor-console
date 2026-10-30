import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const port = Number.parseInt(process.env.HARBOR_E2E_PORT ?? "18484", 10);
const externalBaseURL = process.env.HARBOR_E2E_BASE_URL;
const baseURL = externalBaseURL ?? `http://127.0.0.1:${String(port)}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: 3,
  reporter: "line",
  use: {
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
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
          CONFIG_FILE: fileURLToPath(
            new URL("../configs/config.example.yaml", import.meta.url),
          ),
          HARBOR_CONSOLE_LOGGING__ACCESS_LOG: "false",
          HARBOR_CONSOLE_SERVER__LISTEN: "127.0.0.1",
          HARBOR_CONSOLE_SERVER__PORT: String(port),
        },
        reuseExistingServer: false,
        timeout: 120_000,
        url: `${baseURL}/healthz`,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
