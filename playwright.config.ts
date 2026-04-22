import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4321',
  },
  webServer: {
    command: 'npx serve out -p 4321 --no-clipboard',
    url: 'http://localhost:4321',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
