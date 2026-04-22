import { test, expect } from '@playwright/test';

test('preflight page contains Pre-flight, Anthropic, and OpenAI labels with TrafficLight', async ({
  page,
}) => {
  // Suppress Tauri-IPC errors — expected in browser context
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('tauri')) return;
  });

  await page.goto('/preflight/');
  await expect(page.locator('body')).toContainText('Pre-flight');
  await expect(page.locator('body')).toContainText('Anthropic');
  await expect(page.locator('body')).toContainText('OpenAI');
  // TrafficLight renders with class 'traffic-light'
  await expect(page.locator('.traffic-light').first()).toBeVisible();
});

test('dashboard page loads without JS exceptions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    // Tauri IPC calls are expected to fail in a plain browser
    if (!err.message.includes('tauri') && !err.message.includes('__TAURI__')) {
      errors.push(err.message);
    }
  });

  await page.goto('/dashboard/');
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toHaveLength(0);
});

test('recall-panel page renders (post Phase 2A — chrome + query textarea)', async ({ page }) => {
  // Suppress expected Tauri IPC errors
  page.on('pageerror', () => {});

  await page.goto('/recall-panel/');
  // Phase 2A rewrote the page to a real panel. The chrome strip + query
  // input are the stable structural guarantees.
  await expect(page.locator('.recall-live')).toBeVisible();
  await expect(page.locator('.recall-query-input')).toBeVisible();
});
