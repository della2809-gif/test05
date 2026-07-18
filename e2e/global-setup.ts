import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

export const ADMIN_SESSION = path.join(__dirname, '.auth/admin.json');
export const USER_SESSION = path.join(__dirname, '.auth/user.json');

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();

  // ── Admin 세션 저장 ──────────────────────────────
  {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/login`);
    await page.locator('#email').fill('admin@test.com');
    await page.locator('#password').fill('admin1234!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin', { timeout: 15000 });
    await page.context().storageState({ path: ADMIN_SESSION });
    await page.close();
  }

  // ── 일반 유저 세션 저장 ──────────────────────────
  {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/login`);
    await page.locator('#email').fill('nayeon@wishket.com');
    await page.locator('#password').fill('user1234!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/chat', { timeout: 15000 });
    await page.context().storageState({ path: USER_SESSION });
    await page.close();
  }

  await browser.close();
}

export default globalSetup;
