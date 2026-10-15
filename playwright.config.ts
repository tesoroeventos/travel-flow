import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_INVITE = "PRUEBAE2E2";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  projects: [
    {
      name: "movil",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        launchOptions: process.env.CHROMIUM_PATH
          ? { executablePath: process.env.CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: `rm -rf .data/e2e && next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      AI_FAKE: "1",
      DATABASE_URL: "pglite://./.data/e2e",
      AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
      BOOTSTRAP_INVITE_CODE: E2E_INVITE,
      SEED_DEMO: "true",
      DEMO_SHARE_TOKEN: "demo-e2e",
      APP_URL: `http://localhost:${PORT}`,
    },
  },
});
