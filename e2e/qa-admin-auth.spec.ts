import { test, expect } from '@playwright/test';

/**
 * QA Test: Admin login redirect + regular user /admin block
 * Run with: npx playwright test e2e/qa-admin-auth.spec.ts --headed
 */

test.describe('QA: Admin Auth & Role-based Redirect', () => {
  test.describe.configure({ mode: 'serial' });

  // TC1: Admin login → / → /admin redirect
  test('TC1: 어드민 로그인 후 /admin으로 리다이렉트된다', async ({ page }) => {
    await page.goto('/login');

    // Fill credentials
    await page.locator('#email').fill('admin@test.com');
    await page.locator('#password').fill('admin1234!');
    await page.locator('button[type="submit"]').click();

    // Login triggers window.location.href="/" → middleware redirects admin → /admin
    await page.waitForURL('**/admin', { timeout: 15000 });

    const finalURL = page.url();
    expect(finalURL).toMatch(/\/admin/);
  });

  // TC2: Regular user /admin access → /chat redirect
  test('TC2: 일반 유저가 /admin 접근 시 /chat으로 리다이렉트된다', async ({ page }) => {
    // Log in as regular user
    await page.goto('/login');

    await page.locator('#email').fill('nayeon@wishket.com');
    await page.locator('#password').fill('user1234!');
    await page.locator('button[type="submit"]').click();

    // Should redirect to /chat (onboarding already completed)
    await page.waitForURL('**/chat', { timeout: 15000 });

    // Now attempt to navigate to /admin directly
    await page.goto('/admin');

    // Middleware should block and redirect to /chat
    await page.waitForURL('**/chat', { timeout: 10000 });

    const finalURL = page.url();
    expect(finalURL).toMatch(/\/chat/);
  });
});
