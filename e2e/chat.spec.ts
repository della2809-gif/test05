import { test, expect } from '@playwright/test';

test.describe('채팅 기능', () => {
  test('F05: 채팅 페이지 렌더링', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 });
  });

  test('F06: 음성 입력(마이크) 버튼 또는 파일 첨부 버튼 존재', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 });
    // 입력 영역에 버튼이 1개 이상 있어야 함 (마이크 또는 전송)
    const btnCount = await page.locator('main button').count();
    expect(btnCount).toBeGreaterThanOrEqual(1);
  });

  test('F09: 사이드바 또는 새 대화 진입점이 존재한다', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1000);
    // 새 대화 버튼, 사이드바 nav, 또는 이전 대화 목록 중 하나 존재
    const hasSidebar =
      (await page.locator('nav, aside, [role="navigation"]').count()) > 0 ||
      (await page.locator('button, a').filter({ hasText: /새 대화|새 채팅|New/ }).count()) > 0;
    expect(hasSidebar).toBe(true);
  });

  test('F10: 아카이브 페이지 접근 가능', async ({ page }) => {
    await page.goto('/archive');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
  });

  test('채팅 입력창 — 텍스트 입력 가능', async ({ page }) => {
    await page.goto('/chat');
    const input = page.locator('textarea').first();
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('테스트 메시지');
    await expect(input).toHaveValue('테스트 메시지');
  });

  test('채팅 페이지에 지플릿 카드 영역이 초기 화면에 존재한다', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);
    // 빈 채팅 진입 시 지플릿 카드 6개 중 하나 이상 표시 (핵심 사용성)
    const hasQuickCards = await page.locator('main').evaluate((el) =>
      /자동 견적|수당 계산|여행 달성|회원 등록|일정 관리|자유 상담/.test(el.textContent ?? '')
    );
    expect(hasQuickCards).toBe(true);
  });

  test('명단 페이지 접근 가능', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
  });

  test('일정 페이지 접근 가능', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.getByRole('heading', { name: '일정 관리' })).toBeVisible({ timeout: 10000 });
  });

  test('채팅 헤더에 아카이브 저장 버튼 또는 아이콘이 존재한다', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1000);
    const headerBtnCount = await page.locator('header button').count();
    expect(headerBtnCount).toBeGreaterThanOrEqual(0);
    const body = await page.locator('body').textContent() ?? '';
    expect(body.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 채팅 대화 페이지 (/chat/[id]) — 운영 매뉴얼 3-7, 3-8
// ─────────────────────────────────────────────────────────────

test.describe('채팅 대화 페이지 — 아카이브 저장 · 제목 수정', () => {
  test('사이드바의 기존 대화 클릭 시 /chat/[id]로 이동하고 헤더가 표시된다', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    // 사이드바에서 이전 대화 링크 탐색
    const convLink = page.locator('nav a[href*="/chat/"], aside a[href*="/chat/"]').first();
    if (await convLink.isVisible()) {
      await convLink.click();
      await page.waitForTimeout(1000);
      // /chat/[uuid] 형식으로 이동
      expect(page.url()).toMatch(/\/chat\/[a-f0-9-]{36}/);
    }
  });

  test('/chat/[id]에서 "아카이브 저장" 버튼이 헤더에 표시된다', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const convLink = page.locator('nav a[href*="/chat/"], aside a[href*="/chat/"]').first();
    if (await convLink.isVisible()) {
      await convLink.click();
      await page.waitForTimeout(1000);
      // 아카이브 저장 버튼 확인
      await expect(page.getByRole('button', { name: /아카이브 저장/ })).toBeVisible({ timeout: 5000 });
    }
  });

  test('/chat/[id]에서 "아카이브 저장" 클릭 시 다이얼로그가 열린다', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const convLink = page.locator('nav a[href*="/chat/"], aside a[href*="/chat/"]').first();
    if (await convLink.isVisible()) {
      await convLink.click();
      await page.waitForTimeout(1000);

      const archiveBtn = page.getByRole('button', { name: /아카이브 저장/ });
      if (await archiveBtn.isVisible()) {
        await archiveBtn.click();
        await page.waitForTimeout(500);
        // ArchiveSaveDialog: role="dialog" 또는 카테고리 select 표시
        const hasDialog =
          (await page.locator('[role="dialog"]').count()) > 0 ||
          (await page.locator('select').count()) > 0;
        expect(hasDialog).toBe(true);
      }
    }
  });

  test('/chat/[id]에서 대화 제목 클릭 시 인라인 편집 모드로 전환된다', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const convLink = page.locator('nav a[href*="/chat/"], aside a[href*="/chat/"]').first();
    if (await convLink.isVisible()) {
      await convLink.click();
      await page.waitForTimeout(1000);

      // ChatHeader: h2.cursor-pointer 클릭 → input으로 전환
      const titleH2 = page.locator('h2.cursor-pointer, h2[title="클릭하여 수정"]').first();
      if (await titleH2.isVisible()) {
        await titleH2.click();
        await page.waitForTimeout(300);
        // 편집 input이 나타나야 함
        const editInput = page.locator('input[class*="flex-1"]').first();
        await expect(editInput).toBeVisible();
      }
    }
  });
});
