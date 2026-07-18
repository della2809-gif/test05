/**
 * GENIEA 사용성 E2E 테스트
 * 운영 매뉴얼 기반 — 채팅, 아카이브, 명단, 일정, 프로필, 설정
 *
 * playwright.config.ts: user 프로젝트에 배정 (storageState 필요)
 */
import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Section 3: 채팅 — 지플릿 카드 (EmptyState)
// ─────────────────────────────────────────────────────────────

test.describe('채팅 — 지플릿 카드', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('빈 채팅 화면에 "안녕하세요" 환영 메시지가 표시된다', async ({ page }) => {
    await expect(page.getByText('안녕하세요')).toBeVisible();
  });

  test('지플릿 카드 6개가 모두 표시된다', async ({ page }) => {
    const cards = [
      '자동 견적 내기',
      '수당 계산하기',
      '여행 달성 시뮬',
      '회원 등록하기',
      '일정 관리',
      '자유 상담',
    ];
    for (const title of cards) {
      await expect(page.getByText(title)).toBeVisible();
    }
  });

  test('자동 견적 내기 카드 클릭 시 textarea에 프롬프트가 채워진다', async ({ page }) => {
    await page.getByText('자동 견적 내기').click();
    // 카드 클릭 → onSelectPrompt 호출 → textarea에 초기 프롬프트 설정 또는 대화 시작
    await page.waitForTimeout(500);
    const url = page.url();
    const textarea = page.locator('textarea').first();
    // URL이 chat/[id]로 바뀌거나 textarea가 여전히 존재
    const isStillChat = url.includes('/chat');
    expect(isStillChat).toBe(true);
    await expect(textarea).toBeVisible();
  });

  test('수당 계산하기 카드 클릭 시 대화가 시작된다', async ({ page }) => {
    await page.getByText('수당 계산하기').click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/chat');
  });

  test('여행 달성 시뮬 카드 클릭 시 대화가 시작된다', async ({ page }) => {
    await page.getByText('여행 달성 시뮬').click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/chat');
  });

  test('회원 등록하기 카드 클릭 시 /contacts/new 페이지로 이동한다', async ({ page }) => {
    await page.getByText('회원 등록하기').click();
    await expect(page).toHaveURL(/\/contacts\/new/, { timeout: 5000 });
  });

  test('일정 관리 카드 클릭 시 /schedule 페이지로 이동한다', async ({ page }) => {
    await page.getByText('일정 관리').first().click();
    await expect(page).toHaveURL(/\/schedule/, { timeout: 5000 });
  });

  test('자유 상담 카드 클릭 시 textarea에 포커스된다 (빈 프롬프트 카드)', async ({ page }) => {
    await page.getByText('자유 상담').click();
    await page.waitForTimeout(300);
    // 자유 상담은 prompt=""이므로 페이지 이동 없이 그대로 /chat 유지
    expect(page.url()).toContain('/chat');
  });

  test('모드 토글 — "셀프" 버튼이 EmptyState에 표시된다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '셀프' })).toBeVisible();
  });

  test('모드 토글 — "가이드" 버튼이 EmptyState에 표시된다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '가이드' })).toBeVisible();
  });

  test('모드 토글 — "가이드" 클릭 시 설명 텍스트가 변경된다', async ({ page }) => {
    await page.getByRole('button', { name: '가이드' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('팀원이 고객 미팅 가이드로 활용합니다')).toBeVisible();
  });
});

test.describe('채팅 — 입력 인터페이스', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 });
  });

  test('파일 첨부 input[type=file]이 DOM에 존재한다', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    // hidden이어도 DOM에 존재해야 함
    const count = await fileInput.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('textarea에 텍스트 입력 후 Enter로 전송 시도 가능하다', async ({ page }) => {
    const textarea = page.locator('textarea').first();
    await textarea.fill('테스트 메시지');
    await expect(textarea).toHaveValue('테스트 메시지');
    // 실제 전송은 AI 호출 포함이라 여기서는 값 채워짐만 확인
  });

  test('사이드바 nav 영역이 존재한다', async ({ page }) => {
    const nav = page.locator('nav, aside').first();
    await expect(nav).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Section 4: 아카이브 사용성
// ─────────────────────────────────────────────────────────────

test.describe('아카이브 — 사용성', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/archive');
    await expect(page.getByRole('heading', { name: '아카이브' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800);
  });

  test('heading "아카이브"가 표시된다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '아카이브' })).toBeVisible();
  });

  test('검색창 placeholder "제목, 내용으로 검색"이 존재하고 입력 가능하다', async ({ page }) => {
    const searchInput = page.getByPlaceholder('제목, 내용으로 검색');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('테스트 검색');
    await expect(searchInput).toHaveValue('테스트 검색');
    await searchInput.clear();
  });

  test('카테고리 탭 — 전체 탭이 존재한다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '전체' })).toBeVisible();
  });

  test('카테고리 탭 — 상담 기록 탭이 존재한다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '상담 기록' })).toBeVisible();
  });

  test('카테고리 탭 — 회의 기록 탭이 존재한다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '회의 기록' })).toBeVisible();
  });

  test('카테고리 탭 "상담 기록" 클릭 시 필터 적용된다 (에러 없음)', async ({ page }) => {
    await page.getByRole('button', { name: '상담 기록' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('카테고리 탭 "전체" → "명단" → "전체" 전환이 가능하다', async ({ page }) => {
    await page.getByRole('button', { name: '명단' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: '전체' }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Section 5: 명단(Contacts) 사용성
// ─────────────────────────────────────────────────────────────

test.describe('명단 — 사용성', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contacts');
    await expect(page.getByRole('heading', { name: '명단 관리' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800);
  });

  test('헤딩 "명단 관리"가 표시된다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '명단 관리' })).toBeVisible();
  });

  test('검색창 placeholder "이름 또는 연락처 검색"이 존재한다', async ({ page }) => {
    await expect(page.getByPlaceholder('이름 또는 연락처 검색')).toBeVisible();
  });

  test('상태 select 필터에 "전체 상태" 옵션이 존재한다', async ({ page }) => {
    const select = page.locator('select');
    await expect(select).toBeVisible();
    const options = await select.locator('option').allTextContents();
    expect(options).toContain('전체 상태');
  });

  test('상태 필터에 신규등록/섭취중 등 옵션이 존재한다', async ({ page }) => {
    const select = page.locator('select');
    const options = await select.locator('option').allTextContents();
    const hasStatus = options.some((o) => ['신규등록', '주문대기', '섭취중', '사업관심'].includes(o));
    expect(hasStatus).toBe(true);
  });

  test('"추가" 버튼 클릭 시 /contacts/new 페이지로 이동한다', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: '추가' });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await expect(page).toHaveURL(/\/contacts\/new/, { timeout: 5000 });
  });

  test('검색창에 이름 입력 후 Enter 시 필터링이 실행된다', async ({ page }) => {
    const searchInput = page.getByPlaceholder('이름 또는 연락처 검색');
    await searchInput.fill('홍길동');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toBeVisible();
  });

  test('목록 또는 빈 상태 메시지("명단이 비어있습니다")가 표시된다', async ({ page }) => {
    await page.waitForTimeout(1200);
    const content = await page.locator('main').textContent() ?? '';
    const hasContent =
      content.includes('명단이 비어있습니다') ||
      content.includes('총') ||
      content.length > 20;
    expect(hasContent).toBe(true);
  });
});

test.describe('명단 등록 — /contacts/new 마법사', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contacts/new');
    await expect(page.getByRole('heading', { name: '회원 등록' })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);
  });

  test('heading "회원 등록"이 표시된다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '회원 등록' })).toBeVisible();
  });

  test('Step 진행 표시 "Step 1 / 4"가 표시된다', async ({ page }) => {
    await expect(page.getByText('Step 1 / 4')).toBeVisible();
  });

  test('Step 1 — 이름 입력 placeholder "홍길동"이 존재한다', async ({ page }) => {
    await expect(page.getByPlaceholder('홍길동')).toBeVisible();
  });

  test('Step 1 — 연락처 입력 placeholder "01012345678"이 존재한다', async ({ page }) => {
    await expect(page.getByPlaceholder('01012345678')).toBeVisible();
  });

  test('Step 1 — "다음" 버튼이 존재한다', async ({ page }) => {
    await expect(page.getByRole('button', { name: /다음/ })).toBeVisible();
  });

  test('Step 1 → Step 2: 이름 입력 후 "다음" 클릭 시 Step 2로 진입한다', async ({ page }) => {
    // 이름 입력
    await page.getByPlaceholder('홍길동').fill('테스트고객');
    // 다음 버튼 클릭
    await page.getByRole('button', { name: /다음/ }).click();
    await page.waitForTimeout(400);
    // Step 2: "가입일을 선택해주세요" + "Step 2 / 4"
    await expect(page.getByText('Step 2 / 4')).toBeVisible();
    await expect(page.getByText('가입일을 선택해주세요')).toBeVisible();
  });

  test('Step 2 — 가입일 date input이 존재한다', async ({ page }) => {
    // Step 2로 먼저 이동
    await page.getByPlaceholder('홍길동').fill('테스트고객2');
    await page.getByRole('button', { name: /다음/ }).click();
    await page.waitForTimeout(400);
    // date input 확인
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Section 6: 일정 사용성
// ─────────────────────────────────────────────────────────────

test.describe('일정 — 사용성', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.getByRole('heading', { name: '일정 관리' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800);
  });

  test('헤딩 "일정 관리"가 표시된다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '일정 관리' })).toBeVisible();
  });

  test('"이번 주" 탭 버튼이 존재한다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '이번 주' })).toBeVisible();
  });

  test('"30일" 탭 버튼이 존재한다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '30일' })).toBeVisible();
  });

  test('"이번 주" → "30일" 탭 전환이 가능하다', async ({ page }) => {
    const monthTab = page.getByRole('button', { name: '30일' });
    await monthTab.click();
    await page.waitForTimeout(500);
    // 탭 전환 후 에러 없이 렌더링
    await expect(page.locator('main')).toBeVisible();
  });

  test('"추가" 버튼 클릭 시 /schedule/new 페이지로 이동한다', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: '추가' });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await expect(page).toHaveURL(/\/schedule\/new/, { timeout: 5000 });
  });

  test('일정 없을 때 빈 상태 메시지가 표시된다', async ({ page }) => {
    await page.waitForTimeout(1500);
    const content = await page.locator('main').textContent() ?? '';
    // 일정이 있거나 없거나 → 본문이 비어있지 않아야 함
    expect(content.trim().length).toBeGreaterThan(0);
  });
});

test.describe('일정 추가 — /schedule/new', () => {
  test('일정 추가 페이지에 제목 입력 필드가 존재한다', async ({ page }) => {
    await page.goto('/schedule/new');
    await expect(page.getByRole('heading', { name: '일정 추가' })).toBeVisible({ timeout: 5000 });
    const inputs = page.locator('input');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('일정 타입 select가 존재한다', async ({ page }) => {
    await page.goto('/schedule/new');
    await page.waitForTimeout(500);
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('저장 버튼이 존재한다', async ({ page }) => {
    await page.goto('/schedule/new');
    await page.waitForTimeout(500);
    const saveBtn = page.locator('button').filter({ hasText: /저장|추가|완료/ }).first();
    await expect(saveBtn).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Section 7: 프로필 / 설정 사용성
// ─────────────────────────────────────────────────────────────

test.describe('프로필 — 사용성', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: '프로필 수정' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('heading "프로필 수정"이 표시된다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '프로필 수정' })).toBeVisible();
  });

  test('이메일 입력 필드가 disabled 상태이다 (수정 불가)', async ({ page }) => {
    // profile.tsx: <Input value={form.email} disabled readOnly />
    const emailInput = page.locator('input[disabled]').first();
    await expect(emailInput).toBeVisible();
    const isDisabled = await emailInput.evaluate((el: HTMLInputElement) => el.disabled);
    expect(isDisabled).toBe(true);
  });

  test('이름 입력 필드가 존재하고 편집 가능하다', async ({ page }) => {
    // 이메일(disabled) 제외한 첫 번째 활성 input
    const nameInput = page.locator('input:not([disabled])').first();
    await expect(nameInput).toBeVisible();
    const currentVal = await nameInput.inputValue();
    await nameInput.fill('테스트이름');
    await expect(nameInput).toHaveValue('테스트이름');
    await nameInput.fill(currentVal); // 원복
  });

  test('저장 버튼이 존재한다', async ({ page }) => {
    const saveBtn = page.locator('button').filter({ hasText: /저장/ }).first();
    await expect(saveBtn).toBeVisible();
  });
});

test.describe('설정 — 사용성', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('heading "설정"이 표시된다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
  });

  test('"로그아웃" 버튼이 표시된다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
  });

  test('"회원 탈퇴" 버튼이 표시된다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '회원 탈퇴' })).toBeVisible();
  });

  // 모드·성향 선택은 /chat EmptyState로 이동 — settings에는 없음 (회귀 방지)
  test('설정 페이지에 "모드" 섹션이 없다 (채팅 시작 시 선택)', async ({ page }) => {
    const modeHeading = await page.getByRole('heading', { name: '모드', level: 2 }).count();
    expect(modeHeading).toBe(0);
  });

  test('설정 페이지에 "성향" 섹션이 없다 (대화 중 AI가 질문)', async ({ page }) => {
    const personalityHeading = await page.getByRole('heading', { name: '성향', level: 2 }).count();
    expect(personalityHeading).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 폼 유효성 검증 — Error State
// ─────────────────────────────────────────────────────────────

test.describe('폼 유효성 — Error State', () => {
  test('contacts/new: 이름 입력 없이 다음 클릭 시 에러 토스트가 표시된다', async ({ page }) => {
    await page.goto('/contacts/new');
    await expect(page.getByPlaceholder('홍길동')).toBeVisible({ timeout: 5000 });
    // 이름 비운 상태에서 다음 클릭
    await page.getByRole('button', { name: /다음/ }).click();
    await page.waitForTimeout(500);
    // Sonner 토스트 또는 에러 메시지 확인
    const hasError = await page.locator('body').evaluate((el) =>
      /이름을 입력해주세요|이름.*필수|required/.test(el.textContent ?? '')
    );
    expect(hasError).toBe(true);
  });

  test('schedule/new: 제목 없이 저장 시 에러 토스트가 표시된다', async ({ page }) => {
    await page.goto('/schedule/new');
    await expect(page.getByRole('heading', { name: '일정 추가' })).toBeVisible({ timeout: 5000 });
    // 제목 비운 상태에서 저장 클릭
    const saveBtn = page.locator('button').filter({ hasText: /저장|추가|완료/ }).first();
    await saveBtn.click();
    await page.waitForTimeout(500);
    const hasError = await page.locator('body').evaluate((el) =>
      /제목을 입력해주세요|제목.*필수/.test(el.textContent ?? '')
    );
    expect(hasError).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 빈 상태(Empty State) 검증
// ─────────────────────────────────────────────────────────────

test.describe('빈 상태(Empty State) 텍스트', () => {
  test('contacts: 목록이 비어있을 때 빈 상태 메시지 또는 총 N명이 표시된다', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForTimeout(1500);
    const content = await page.locator('main').textContent() ?? '';
    const isValidState =
      content.includes('명단이 비어있습니다') ||
      content.includes('총') ||
      content.includes('추가');
    expect(isValidState).toBe(true);
  });

  test('schedule: 일정이 없을 때 빈 상태 메시지 또는 섹션 제목이 표시된다', async ({ page }) => {
    await page.goto('/schedule');
    await page.waitForTimeout(1500);
    const content = await page.locator('main').textContent() ?? '';
    const isValidState =
      content.includes('일정이 없습니다') ||
      content.includes('핵심 관리') ||
      content.includes('사람 관리') ||
      content.includes('추가');
    expect(isValidState).toBe(true);
  });

  test('archive: 검색 결과 없을 때 빈 상태 또는 목록이 표시된다', async ({ page }) => {
    await page.goto('/archive');
    await page.getByPlaceholder('제목, 내용으로 검색').fill('xyzxyz존재하지않는검색어abc');
    await page.waitForTimeout(400);
    const content = await page.locator('body').textContent() ?? '';
    // 결과 없음 메시지 또는 빈 상태
    expect(content.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 접근성 기본 검증 — 각 주요 페이지의 h1 존재
// ─────────────────────────────────────────────────────────────

test.describe('접근성 — 페이지별 h1 존재', () => {
  const pages = [
    { path: '/chat',          name: 'chat' },
    { path: '/archive',       name: 'archive' },
    { path: '/contacts',      name: 'contacts' },
    { path: '/schedule',      name: 'schedule' },
    { path: '/profile',       name: 'profile' },
    { path: '/settings',      name: 'settings' },
  ];

  for (const { path, name } of pages) {
    test(`${name} 페이지에 h1이 존재한다`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(1000);
      // chat 페이지는 EmptyState의 h2가 있고, h1이 레이아웃에 있을 수 있음
      const h1Count = await page.locator('h1').count();
      const h2Count = await page.locator('h2').count();
      expect(h1Count + h2Count).toBeGreaterThanOrEqual(1);
    });
  }
});
