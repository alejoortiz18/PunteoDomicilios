import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5125',
    browserName: 'chromium',
    headless: false,         // SIEMPRE visible — ver el navegador en vivo
    slowMo: 400,             // 400 ms entre acciones para seguir el flujo cómodamente
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 1400, height: 900 },
  },
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'resultadosPruebas/playwright-report', open: 'on-failure' }],
  ],
});
