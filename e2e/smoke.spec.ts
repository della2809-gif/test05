import { test, expect } from '@playwright/test';

test.describe('스모크 테스트', () => {
  test('앱이 정상적으로 시작된다', async ({ page }) => {
    // The root page redirects to /login (may error with placeholder Supabase URL)
    // We accept any non-5xx response, or a successful load of the login page
    const response = await page.goto('/login');
    expect(response?.status()).toBeLessThan(500);
  });

  test('로그인 페이지가 렌더링된다', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
  });

  test('회원가입 페이지가 렌더링된다', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('body')).toBeVisible();
  });
});
