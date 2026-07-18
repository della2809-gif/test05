/**
 * 관리자 페이지 E2E 테스트
 * 소스 기반 정확한 heading/button 텍스트 사용
 *
 * playwright.config.ts: admin 프로젝트에 배정 (storageState: e2e/.auth/admin.json)
 */
import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// 대시보드 (/admin)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 대시보드', () => {
  test('대시보드 heading 렌더링', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
  });

  test('전체 통계 — 전체 사용자 카드 표시', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    await expect(
      page.locator('p, span, div').filter({ hasText: /^전체 사용자$/ }).first()
    ).toBeVisible();
  });

  test('전체 통계 — 유료 사용자 카드 표시', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    const hasCard = await page.locator('body').evaluate((el) =>
      /유료 사용자/.test(el.textContent ?? '')
    );
    expect(hasCard).toBe(true);
  });

  test('전체 통계 — 전체 대화 카드 표시', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    const hasCard = await page.locator('body').evaluate((el) =>
      /전체 대화/.test(el.textContent ?? '')
    );
    expect(hasCard).toBe(true);
  });

  test('팀 통계 카드 영역 (전체 명단/상담기록/진행중 일정) 표시', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    const hasTeamStats = await page.locator('body').evaluate((el) =>
      /전체 명단|전체 상담|진행중 일정/.test(el.textContent ?? '')
    );
    expect(hasTeamStats).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 사용자 관리 (/admin/users)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 사용자 관리', () => {
  test('heading "사용자 관리" 렌더링', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();
  });

  test('검색창 placeholder "이름 또는 연락처 (완전 일치)" 존재', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByPlaceholder('이름 또는 연락처 (완전 일치)')).toBeVisible();
  });

  test('상태 필터 (전체/Free/Paid) 텍스트 존재', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForTimeout(500);
    const hasFilter = await page.locator('body').evaluate((el) =>
      /Free|Paid|전체/.test(el.textContent ?? '')
    );
    expect(hasFilter).toBe(true);
  });

  test('사용자 테이블 렌더링 및 Paid/Free 전환 버튼 존재', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForSelector('table', { timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /Paid 전환|Free 전환/ }).first()
    ).toBeVisible();
  });

  test('무료 기간 연장 버튼 (Free 유저 있을 때)', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForSelector('table', { timeout: 10000 });
    const count = await page.getByRole('button', { name: '무료 기간 연장' }).count();
    if (count > 0) {
      await expect(page.getByRole('button', { name: '무료 기간 연장' }).first()).toBeVisible();
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 시스템 프롬프트 (/admin/prompts)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 시스템 프롬프트', () => {
  test('heading "시스템 프롬프트" 렌더링', async ({ page }) => {
    await page.goto('/admin/prompts');
    await expect(page.getByRole('heading', { name: '시스템 프롬프트' })).toBeVisible();
  });

  test('6개 탭(기본/자동견적/수당계산/스토리/일정관리/여행달성) 렌더링', async ({ page }) => {
    await page.goto('/admin/prompts');
    await page.waitForTimeout(500);
    const tabs = ['기본', '자동견적', '수당계산', '스토리', '일정관리', '여행달성'];
    for (const tab of tabs) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('"자동견적" 탭 클릭 시 전환된다', async ({ page }) => {
    await page.goto('/admin/prompts');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '자동견적' }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('textarea').first()).toBeVisible();
  });

  test('"저장" 버튼이 존재한다', async ({ page }) => {
    await page.goto('/admin/prompts');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '저장' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 제품 마스터 (/admin/products)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 제품 마스터 관리', () => {
  test('heading "제품 마스터 관리" 렌더링', async ({ page }) => {
    await page.goto('/admin/products');
    await expect(page.getByRole('heading', { name: '제품 마스터 관리' })).toBeVisible();
  });

  test('"제품 추가" 버튼이 존재한다', async ({ page }) => {
    await page.goto('/admin/products');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '제품 추가' })).toBeVisible();
  });

  test('"제품 추가" 버튼 클릭 시 모달/폼이 열린다', async ({ page }) => {
    await page.goto('/admin/products');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '제품 추가' }).click();
    await page.waitForTimeout(500);
    const hasForm =
      (await page.locator('[role="dialog"]').count()) > 0 ||
      (await page.locator('form').count()) > 0 ||
      (await page.locator('input[placeholder*="제품명"]').count()) > 0;
    expect(hasForm).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 계산/기본값 (/admin/calculations)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 계산/기본값 관리', () => {
  test('heading "계산/기본값 관리" 렌더링', async ({ page }) => {
    await page.goto('/admin/calculations');
    await expect(page.getByRole('heading', { name: '계산/기본값 관리' })).toBeVisible();
  });

  test('"항목 추가" 버튼이 존재한다', async ({ page }) => {
    await page.goto('/admin/calculations');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '항목 추가' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 템플릿 관리 (/admin/templates)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 질문 템플릿 관리', () => {
  test('heading "질문 템플릿 관리" 렌더링', async ({ page }) => {
    await page.goto('/admin/templates');
    await expect(page.getByRole('heading', { name: '질문 템플릿 관리' })).toBeVisible();
  });

  test('"템플릿 추가" 버튼이 존재한다', async ({ page }) => {
    await page.goto('/admin/templates');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '템플릿 추가' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 패키지 DB (/admin/packages)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 패키지 DB', () => {
  test('heading "패키지 DB" 렌더링', async ({ page }) => {
    await page.goto('/admin/packages');
    await expect(page.getByRole('heading', { name: '패키지 DB' })).toBeVisible();
  });

  test('"패키지 추가" 버튼이 존재한다', async ({ page }) => {
    await page.goto('/admin/packages');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '패키지 추가' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 스토리 DB (/admin/stories)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 스토리 관리', () => {
  test('heading "스토리 관리" 렌더링', async ({ page }) => {
    await page.goto('/admin/stories');
    await expect(page.getByRole('heading', { name: '스토리 관리' })).toBeVisible();
  });

  test('"스토리 추가" 버튼이 존재한다', async ({ page }) => {
    await page.goto('/admin/stories');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '스토리 추가' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 링크 DB (/admin/links)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 링크 관리', () => {
  test('heading "링크 관리" 렌더링', async ({ page }) => {
    await page.goto('/admin/links');
    await expect(page.getByRole('heading', { name: '링크 관리' })).toBeVisible();
  });

  test('"링크 추가" 버튼이 존재한다', async ({ page }) => {
    await page.goto('/admin/links');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '링크 추가' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// FAQ DB (/admin/faqs)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — FAQ 관리', () => {
  test('heading "FAQ 관리" 렌더링', async ({ page }) => {
    await page.goto('/admin/faqs');
    await expect(page.getByRole('heading', { name: 'FAQ 관리' })).toBeVisible();
  });

  test('"FAQ 추가" 버튼이 존재한다', async ({ page }) => {
    await page.goto('/admin/faqs');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'FAQ 추가' })).toBeVisible();
  });

  test('검색창 placeholder "질문으로 검색..." 존재', async ({ page }) => {
    await page.goto('/admin/faqs');
    await page.waitForTimeout(500);
    await expect(page.getByPlaceholder('질문으로 검색...')).toBeVisible();
  });

  test('"FAQ 추가" 클릭 시 모달/폼이 열린다', async ({ page }) => {
    await page.goto('/admin/faqs');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'FAQ 추가' }).click();
    await page.waitForTimeout(500);
    const hasForm =
      (await page.locator('[role="dialog"]').count()) > 0 ||
      (await page.locator('form').count()) > 0 ||
      (await page.locator('textarea').count()) > 0;
    expect(hasForm).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 이미지 DB (/admin/images)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 이미지 지플릿 관리', () => {
  test('heading "이미지 지플릿 관리" 렌더링', async ({ page }) => {
    await page.goto('/admin/images');
    await expect(page.getByRole('heading', { name: '이미지 지플릿 관리' })).toBeVisible();
  });

  test('"이미지 추가" 버튼이 존재한다', async ({ page }) => {
    await page.goto('/admin/images');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '이미지 추가' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 파일 업로드 (/admin/files)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 파일 업로드 관리', () => {
  test('heading "파일 업로드 관리" 렌더링', async ({ page }) => {
    await page.goto('/admin/files');
    await expect(page.getByRole('heading', { name: '파일 업로드 관리' })).toBeVisible();
  });

  test('파일 업로드 input 또는 드롭존이 존재한다', async ({ page }) => {
    await page.goto('/admin/files');
    await page.waitForTimeout(500);
    const hasUpload =
      (await page.locator('input[type="file"]').count()) > 0 ||
      (await page.locator('button').filter({ hasText: /파일 선택|업로드/ }).count()) > 0;
    expect(hasUpload).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 어드민 사이드바 네비게이션
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 사이드바 네비게이션', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible({ timeout: 10000 });
  });

  test('사이드바에 "사용자 관리" 링크가 존재하고 클릭 시 이동한다', async ({ page }) => {
    const link = page.locator('nav a, aside a').filter({ hasText: '사용자 관리' }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 5000 });
  });

  test('사이드바에 "시스템 프롬프트" 링크가 존재하고 클릭 시 이동한다', async ({ page }) => {
    const link = page.locator('nav a, aside a').filter({ hasText: '시스템 프롬프트' }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/admin\/prompts/, { timeout: 5000 });
  });

  test('사이드바에 "제품 마스터" 링크가 존재하고 클릭 시 이동한다', async ({ page }) => {
    const link = page.locator('nav a, aside a').filter({ hasText: '제품 마스터' }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/admin\/products/, { timeout: 5000 });
  });

  test('사이드바에 "FAQ DB" 링크가 존재하고 클릭 시 이동한다', async ({ page }) => {
    const link = page.locator('nav a, aside a').filter({ hasText: 'FAQ DB' }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/admin\/faqs/, { timeout: 5000 });
  });

  test('사이드바에 "유튜브 DB" 링크가 존재하고 클릭 시 이동한다', async ({ page }) => {
    const link = page.locator('nav a, aside a').filter({ hasText: '유튜브 DB' }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/admin\/youtube/, { timeout: 5000 });
  });

  test('사이드바에 "블록 관리" 링크가 없다 (제거됨)', async ({ page }) => {
    const link = page.locator('nav a, aside a').filter({ hasText: '블록 관리' });
    const count = await link.count();
    expect(count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 유튜브 DB (/admin/youtube)
// ─────────────────────────────────────────────────────────────

test.describe('어드민 — 유튜브 텍스트 DB', () => {
  test('heading "유튜브 텍스트 DB 관리" 렌더링', async ({ page }) => {
    await page.goto('/admin/youtube');
    await expect(page.getByRole('heading', { name: '유튜브 텍스트 DB 관리' })).toBeVisible();
  });

  test('"추가" 버튼 클릭 시 YouTube URL 입력 모달 열림', async ({ page }) => {
    await page.goto('/admin/youtube');
    await page.getByRole('button', { name: '추가' }).first().click();
    await expect(page.getByPlaceholder('https://www.youtube.com/watch?v=...')).toBeVisible();
  });
});
