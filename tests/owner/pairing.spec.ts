import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test, expect } from '@playwright/test';
import worker from '../../service/worker';
import type { Env, Statement } from '../../service/types';

const ownerKey = 'test-owner-key-'.repeat(6);
let sqlite: DatabaseSync;

test.beforeEach(async ({ page, context }) => {
  sqlite = new DatabaseSync(':memory:');
  for (const name of readdirSync('service/migrations').filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(`service/migrations/${name}`, 'utf8'));
  }
  const env: Env = {
    ADMIN_TOKEN: ownerKey, APP_ORIGIN: 'https://family.example', SYNC_PAUSED: 'false',
    GITHUB_APP_ID: '', GITHUB_INSTALLATION_ID: '', GITHUB_PRIVATE_KEY: '',
    DB: {
      prepare(sql): Statement {
        let args: (string | number | null)[] = [];
        return {
          bind(...values) { args = values; return this; },
          async first<T>() { return sqlite.prepare(sql).get(...args) as T ?? null; },
          async all<T>() { return { results: sqlite.prepare(sql).all(...args) as T[] }; },
          async run() { return sqlite.prepare(sql).run(...args); },
        };
      },
      async batch() { throw new Error('Pairing itself is covered by Worker tests.'); },
    },
  };
  // Real Worker routing/authentication/SQL behind a simulated HTTPS transport.
  await page.route('https://sync.example/**', async route => {
    const request = route.request();
    // WebKit attaches HttpOnly cookies after interception. Forward the browser's
    // actual URL-scoped cookie store through this simulated transport.
    const headers = await request.allHeaders();
    headers.cookie = (await context.cookies(request.url())).map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const response = await worker.fetch(new Request(request.url(), {
      method: request.method(), headers, body: request.postData(),
    }), env);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
  await page.route('https://h-wilderspin.github.io/**', route => route.abort());
});
test.afterEach(() => sqlite.close());

test('signs in, creates a code, reloads the session and signs out at phone width', async ({ page, context, browserName }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/admin');
  await page.getByLabel('Owner key').fill('wrong-key');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Sign in with your owner key');
  await page.getByLabel('Owner key').fill(ownerKey);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Device name')).toBeVisible();
  await expect(page.getByLabel('Owner key')).toHaveValue('');
  const cookies = await context.cookies();
  expect(cookies[0]).toMatchObject({ httpOnly: true, secure: true, path: '/admin' });
  // Windows WebKit reports None for intercepted cookies; the server's Strict
  // attribute and cross-origin rejection are independently checked in unit tests.
  if (browserName === 'chromium') expect(cookies[0]?.sameSite).toBe('Strict');
  expect(await page.evaluate(() => document.cookie)).toBe('');
  const label = '<img src=x onerror=alert(1)> tablet';
  await page.getByLabel('Device name').fill(label);
  await page.getByRole('button', { name: 'Create pairing code' }).click();
  await expect(page.locator('#code')).toHaveText(/^\d{6}$/);
  await expect(page.locator('#device-name')).toHaveText(label);
  await expect(page.locator('#expiry')).toContainText('Expires');
  await expect(page.locator('#result-title')).toBeFocused();
  expect(sqlite.prepare('SELECT COUNT(*) AS total FROM invites').get()?.total).toBe(1);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Permission denied'); } } }));
  await page.getByRole('button', { name: 'Copy code' }).click();
  await expect(page.getByRole('status')).toContainText('Touch and hold');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Device name')).toBeVisible();
  await expect(page.locator('#result')).toBeHidden();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Owner key')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Owner key')).toBeVisible();
  expect(await context.cookies()).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('preserves leading zeros when copying and sharing, and fits a narrow screen with large text', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { document.body.dataset.copied = text; } } });
    Object.defineProperty(navigator, 'share', { value: async (data: ShareData) => { document.body.dataset.shared = data.text; } });
  });
  await page.goto('/admin');
  await page.getByLabel('Owner key').fill(ownerKey);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Device name').fill('Phone');
  await page.route('**/admin/invites', route => route.fulfill({ json: { code: '001234', expires: Date.now() + 86400000 } }));
  await page.getByRole('button', { name: 'Create pairing code' }).click();
  await expect(page.locator('#code')).toHaveText('001234');
  await page.getByRole('button', { name: 'Copy code' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-copied', '001234');
  await page.getByRole('button', { name: 'Share instructions' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-shared', /Phone: 001234.*Family connection/);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('handles the unused-code limit, a lost response and an expired login without duplicate submission', async ({ page, context }) => {
  await page.goto('/admin/');
  await page.getByLabel('Owner key').fill(ownerKey);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Device name').fill('Tablet');
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Create pairing code' }).click();
    await expect(page.getByRole('status')).toHaveText('Pairing code created.');
  }
  const lastCode = await page.locator('#code').textContent();
  await page.getByRole('button', { name: 'Create pairing code' }).click();
  await expect(page.getByRole('alert')).toContainText('up to five at once');
  await expect(page.locator('#code')).toHaveText(lastCode!);
  expect(sqlite.prepare('SELECT COUNT(*) AS total FROM invites').get()?.total).toBe(5);
  await page.route('**/admin/invites', route => route.abort(), { times: 1 });
  await page.getByRole('button', { name: 'Create pairing code' }).click();
  await expect(page.getByRole('alert')).toContainText('it may have been created');
  await context.clearCookies();
  await page.getByRole('button', { name: 'Create pairing code' }).click();
  await expect(page.getByLabel('Owner key')).toBeVisible();
  await expect(page.locator('#result')).toBeHidden();
});
