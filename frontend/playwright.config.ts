import { defineConfig, devices } from "@playwright/test";

const PORT = 18600;

// The real backend serving the exported UI; `make e2e` provides the command.
export default defineConfig({
  testDir: "e2e",
  reporter: "line",
  use: { baseURL: `http://127.0.0.1:${PORT}`, locale: "fr-FR", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${process.env.E2E_SERVER} --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/v1/system/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
