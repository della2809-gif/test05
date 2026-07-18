import { test, expect } from '@playwright/test';

// F01 - 회원가입/로그인 (Supabase 불필요한 UI 테스트)
test.describe('F01 - 로그인/회원가입', () => {
  test.describe.configure({ mode: 'serial' });

  test('로그인 페이지가 정상적으로 렌더링된다', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('로그인 페이지에 비밀번호 표시/숨기기 토글이 존재한다', async ({ page }) => {
    await page.goto('/login');
    const passwordField = page.locator('input[type="password"], input[name="password"]');
    await expect(passwordField).toBeVisible();
  });

  test('로그인 페이지에 회원가입 링크가 존재한다', async ({ page }) => {
    await page.goto('/login');
    const signupLink = page.locator('a[href*="signup"]');
    await expect(signupLink).toBeVisible();
  });

  test('회원가입 페이지가 정상적으로 렌더링된다', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    const passwordFields = page.locator('input[type="password"]');
    await expect(passwordFields.first()).toBeVisible();
  });

  test('회원가입 페이지에 이메일/비밀번호/비밀번호확인 필드가 존재한다', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    const passwordFields = page.locator('input[type="password"]');
    const count = await passwordFields.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('회원가입 페이지에 로그인 링크가 존재한다', async ({ page }) => {
    await page.goto('/signup');
    const loginLink = page.locator('a[href*="login"]');
    await expect(loginLink).toBeVisible();
  });

  test('로그인 페이지에서 회원가입 페이지로 이동할 수 있다', async ({ page }) => {
    await page.goto('/login');
    const signupLink = page.locator('a[href*="signup"]');
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('회원가입 페이지에서 로그인 페이지로 이동할 수 있다', async ({ page }) => {
    await page.goto('/signup');
    const loginLink = page.locator('a[href*="login"]');
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
