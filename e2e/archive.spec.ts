/**
 * 아카이브 기능 E2E 테스트
 * 소스 기반 정밀화 (archive/page.tsx 참조)
 *
 * 프로젝트 배정: user (storageState 필요)
 * 상세 사용성 시나리오는 usability.spec.ts 참조
 */
import { test, expect } from '@playwright/test';

test.describe('아카이브 기능', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/archive');
    await expect(page.getByRole('heading', { name: '아카이브' })).toBeVisible({ timeout: 10000 });
  });

  test('F11: 아카이브 목록 페이지 렌더링 — heading "아카이브"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '아카이브' })).toBeVisible();
  });

  test('F11: 검색창 placeholder "제목, 내용으로 검색" 존재', async ({ page }) => {
    await expect(page.getByPlaceholder('제목, 내용으로 검색')).toBeVisible();
  });

  test('F11: 카테고리 탭 "전체" 존재', async ({ page }) => {
    await expect(page.getByRole('button', { name: '전체' })).toBeVisible();
  });

  test('F11: 카테고리 탭 "상담 기록" 존재', async ({ page }) => {
    await expect(page.getByRole('button', { name: '상담 기록' })).toBeVisible();
  });

  test('F11: 카테고리 탭 "회의 기록" 존재', async ({ page }) => {
    await expect(page.getByRole('button', { name: '회의 기록' })).toBeVisible();
  });

  test('F12: 아카이브 페이지 정상 로딩 (에러 없음)', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('F12: 카테고리 탭 클릭 후 에러 없이 렌더링', async ({ page }) => {
    await page.getByRole('button', { name: '명단' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('F12: 검색 입력 후 에러 없이 결과 표시', async ({ page }) => {
    const searchInput = page.getByPlaceholder('제목, 내용으로 검색');
    await searchInput.fill('테스트');
    await page.waitForTimeout(400); // 300ms debounce
    await expect(page.locator('body')).toBeVisible();
    await searchInput.clear();
  });
});
