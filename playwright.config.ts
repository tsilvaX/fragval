import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    httpCredentials: { username: "friend", password: "court-e2e-password" },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `${process.platform === "win32" ? "npm.cmd" : "npm"} run dev`,
    url: "http://127.0.0.1:3000/api/dashboard",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: { DATA_PROVIDER: "fixture", DATABASE_PATH: "data/e2e.sqlite" },
  },
});
