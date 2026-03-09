const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '*.e2e.js',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'node tests/serve.js',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
