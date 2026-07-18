import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const LINKS = [
  { id: '0_이전운영자DB', url: 'https://chatgpt.com/share/69bbcff1-7bc0-800d-9eb5-191ac42d0698' },
  { id: '1_이미지지플릿', url: 'https://chatgpt.com/share/69dbe6ca-65b0-83a9-a9c0-7b9d2a1bdf82' },
  { id: '2_링크지플릿', url: 'https://chatgpt.com/share/69d7d311-5e24-83a7-b043-e68068ccc430' },
  { id: '3_스토리지플릿', url: 'https://chatgpt.com/share/69d7cfed-8eb4-83a4-a18f-ef13c3e89b1d' },
  { id: '4_5_수당계산_여행달성', url: 'https://chatgpt.com/share/69dddddc-a124-83aa-a9fc-86a5024baffe' },
  { id: '6_자동견적_제품추천', url: 'https://chatgpt.com/share/69ddd674-ff00-83a3-89bf-458efce33ce7' },
  { id: '12_일정관리', url: 'https://chatgpt.com/share/69de54bd-55b0-83ab-afeb-a132e32c3329' },
  { id: '14_명단지플릿', url: 'https://chatgpt.com/share/69dde417-9474-83a4-9026-b50efefa31fd' },
];

const OUT_DIR = path.join(
  process.cwd(),
  '00_requirements/attachments/original/2026-04-14__usanaheejung516@gmail.com__GPT시뮬레이션'
);
const MD_DIR = path.join(
  process.cwd(),
  '00_requirements/attachments/md'
);

async function extractConversation(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const lines: string[] = [];

    // 방법 1: data-testid 기반 (ChatGPT 최신 구조)
    const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
    if (turns.length > 0) {
      turns.forEach((turn) => {
        const userEl = turn.querySelector('[data-message-author-role="user"]');
        const assistantEl = turn.querySelector('[data-message-author-role="assistant"]');
        const el = userEl || assistantEl;
        if (!el) return;
        const role = userEl ? 'USER' : 'ASSISTANT';
        const text = (el as HTMLElement).innerText?.trim();
        if (text) lines.push(`[${role}]\n${text}`);
      });
    }

    // 방법 2: article 태그 기반 (공유 페이지 구조)
    if (lines.length === 0) {
      document.querySelectorAll('article').forEach((article) => {
        const text = (article as HTMLElement).innerText?.trim();
        if (text) lines.push(text);
      });
    }

    // 방법 3: 전체 main 텍스트 fallback
    if (lines.length === 0) {
      const main = document.querySelector('main');
      return (main as HTMLElement | null)?.innerText?.trim() || document.body.innerText;
    }

    return lines.join('\n\n---\n\n');
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(MD_DIR, { recursive: true });

  // 시스템 Chrome을 headed 모드로 실행 (JS 실행 가능, 공유 링크는 로그인 불필요할 수도 있음)
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // 첫 번째 링크로 이동해서 로그인 상태 확인
  console.log('🌐 ChatGPT 열는 중...');
  await page.goto('https://chatgpt.com', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const isLoginPage = page.url().includes('auth') || page.url().includes('login');
  if (isLoginPage) {
    console.log('⚠️  로그인 필요 — 브라우저에서 ChatGPT에 로그인해주세요. 로그인 완료 후 Enter...');
    await page.waitForURL('https://chatgpt.com/**', { timeout: 120000 });
    await page.waitForTimeout(2000);
  } else {
    console.log('✅ 로그인 확인됨');
  }

  const results: Array<{ id: string; content: string }> = [];

  for (const link of LINKS) {
    console.log(`\n📄 [${link.id}] 가져오는 중...`);
    try {
      await page.goto(link.url, { waitUntil: 'networkidle', timeout: 40000 });
      await page.waitForTimeout(4000); // React hydration 대기

      // 로그인 페이지로 리다이렉트됐으면 대기
      if (page.url().includes('auth') || page.url().includes('login')) {
        console.log('  ⚠️  인증 페이지로 리다이렉트됨, 대기...');
        await page.waitForURL(/chatgpt\.com\/share/, { timeout: 60000 });
        await page.waitForTimeout(3000);
      }

      const title = await page.title();
      console.log(`  제목: ${title}`);

      const content = await extractConversation(page);
      const charCount = content?.length || 0;
      console.log(`  추출: ${charCount} 글자`);

      if (charCount < 100) {
        // 내용이 너무 적으면 스크린샷 저장
        await page.screenshot({
          path: path.join(OUT_DIR, `debug_${link.id}.png`),
          fullPage: true,
        });
        console.log(`  ⚠️  내용 부족 — 스크린샷 저장됨`);
      }

      const filename = `2026-04-14__usanaheejung516@gmail.com__GPT_${link.id}`;
      const txtPath = path.join(OUT_DIR, `${filename}.txt`);
      const mdPath = path.join(MD_DIR, `${filename}.md`);

      const mdContent = `# GPT 시뮬레이션: ${link.id}\n\n> URL: ${link.url}\n> 수집일: 2026-04-16\n\n---\n\n${content}`;

      fs.writeFileSync(txtPath, content, 'utf-8');
      fs.writeFileSync(mdPath, mdContent, 'utf-8');
      console.log(`  ✅ 저장: ${filename}.txt / .md`);

      results.push({ id: link.id, content });
    } catch (err) {
      console.error(`  ❌ 실패: ${link.id}`, (err as Error).message);
    }
  }

  await browser.close();

  console.log('\n\n✅ 전체 완료!');
  console.log(`저장 위치 (원본): ${OUT_DIR}`);
  console.log(`저장 위치 (MD):   ${MD_DIR}`);
}

main().catch(console.error);
