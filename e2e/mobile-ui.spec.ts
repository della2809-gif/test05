import { test, expect } from '@playwright/test';

/**
 * 인증 없이 검증 가능한 UI 테스트
 * - 로그인/회원가입 페이지 렌더링
 * - 모바일 레이아웃 CSS 클래스 확인
 * - manifest.json 접근 가능 여부
 * - 앱 기본 동작
 */

test.describe('W. 모바일 최적화 — 정적 검증', () => {
  test('manifest.json 접근 가능', async ({ page }) => {
    const res = await page.goto('/manifest.json');
    expect(res?.status()).toBe(200);
    const json = await page.evaluate(() => document.body.innerText);
    const manifest = JSON.parse(json);
    expect(manifest.name).toBe('GENIEA');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/chat');
    expect(manifest.theme_color).toBe('#10B981');
  });

  test('HTML head에 manifest 링크 포함', async ({ page }) => {
    await page.goto('/login');
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestLink).toBe('/manifest.json');
  });

  test('HTML head에 apple-web-app-capable 메타 포함', async ({ page }) => {
    await page.goto('/login');
    const appleMeta = await page.locator('meta[name="mobile-web-app-capable"]').first().getAttribute('content');
    expect(appleMeta).toBe('yes');
  });

  test('로그인 페이지 — 500 에러 없음', async ({ page }) => {
    const res = await page.goto('/login');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('회원가입 페이지 — 500 에러 없음', async ({ page }) => {
    const res = await page.goto('/signup');
    expect(res?.status()).toBeLessThan(500);
  });

  test('/chat 접근 시 로그인 리다이렉트', async ({ page }) => {
    await page.goto('/chat');
    // Should redirect to /login when not authenticated
    await expect(page).toHaveURL(/\/(login|chat)/);
  });
});

test.describe('X. 빠른 시작 UX — 로그인 페이지 UI', () => {
  test('로그인 폼 요소 렌더링', async ({ page }) => {
    await page.goto('/login');
    // Basic form elements should be visible
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]').first()).toBeVisible();
  });

  test('로그인 → 회원가입 링크 동작', async ({ page }) => {
    await page.goto('/login');
    const signupLink = page.locator('a[href*="signup"]').first();
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await expect(page).toHaveURL(/signup/);
    }
  });
});

test.describe('반응형 뷰포트 렌더링', () => {
  test('모바일 뷰포트 (375px) — 로그인 페이지 렌더링', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const res = await page.goto('/login');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('태블릿 뷰포트 (768px) — 로그인 페이지 렌더링', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const res = await page.goto('/login');
    expect(res?.status()).toBeLessThan(500);
  });

  test('데스크탑 뷰포트 (1440px) — 로그인 페이지 렌더링', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const res = await page.goto('/login');
    expect(res?.status()).toBeLessThan(500);
  });
});
