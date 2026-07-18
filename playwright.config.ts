import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3010',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // ── 인증 없는 테스트 ──────────────────────────
    {
      name: 'no-auth',
      testMatch: [
        'smoke.spec.ts',
        'auth.spec.ts',
        'mobile-ui.spec.ts',
        'qa-admin-auth.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    // ── 어드민 세션 필요 ──────────────────────────
    {
      name: 'admin',
      testMatch: ['admin.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    // ── 일반 유저 세션 필요 ───────────────────────
    {
      name: 'user',
      testMatch: ['chat.spec.ts', 'archive.spec.ts', 'usability.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3010/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
