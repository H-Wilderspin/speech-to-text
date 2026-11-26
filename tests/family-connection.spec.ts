import { expect, test, type Page } from '@playwright/test';

async function fixture(page: Page) {
  const state = { paused: false, revoked: false, badCode: false, limited: false, emailEnabled: false, emailFailed: false,
    emailRequests: 0, pairingRequests: 0, writes: 0, requests: 0, items: [] as { id: string; text: string; checked: boolean }[] };
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ json: { version: 1, items: [], meals: {} } }));
  await page.route('https://family.example/**', async route => {
    state.requests++;
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/pair/options') return route.fulfill({ json: {
      emailEnabled: state.emailEnabled, emails: state.emailEnabled ? ['dad@example.test', 'mum@example.test', 'sibling@example.test'] : [],
    } });
    if (url.pathname === '/pair/email') {
      state.emailRequests++;
      expect(request.postDataJSON().email).toBe('dad@example.test');
      expect(request.headers().authorization).toBeUndefined();
      if (state.emailFailed) return route.fulfill({ status: 503, json: { error: 'Email codes are not available. Ask the family administrator for a pairing code.' } });
      return route.fulfill({ status: 202, json: {
        message: 'If this email is approved, a code should arrive shortly. Check your spam folder, or ask the family administrator for a pairing code.', retryAfter: 60,
      } });
    }
    if (url.pathname === '/pair') {
      state.pairingRequests++;
      expect(request.postDataJSON().code).toMatch(/^(?:[0-9]{6}|[A-F0-9]{20})$/);
      if (state.limited) return route.fulfill({ status: 429, headers: { 'Retry-After': '900' }, json: { error: 'Too many pairing attempts. Please try again in 15 minutes.' } });
      if (state.badCode) return route.fulfill({ status: 400, json: { error: 'This code has expired. Ask for a new code.' } });
      state.revoked = false;
      return route.fulfill({ json: { connected: true } });
    }
    if (state.revoked) return route.fulfill({ status: 401, json: { error: 'This device is no longer connected. Ask for a new pairing code in Settings.' } });
    if (state.paused) return route.fulfill({ status: 503, headers: { 'Retry-After': '3600' }, json: { error: 'Family syncing is resting. Your changes stay on this device.' } });
    if (url.pathname === '/session') return route.fulfill({ json: { connected: true } });
    if (url.searchParams.get('path') === 'shopping/list.json') {
      if (request.method() === 'PUT') { state.items = request.postDataJSON().value.items; state.writes++; }
      return route.fulfill({ json: { sha: 'revision', value: { version: 1, items: state.items } } });
    }
    return route.fulfill({ json: { sha: 'revision', value: { version: 1, meals: {}, items: [] } } });
  });
  return state;
}
async function pair(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Pairing code')).toHaveAttribute('inputmode', 'numeric');
  await expect(page.getByLabel('Pairing code')).toHaveAttribute('autocomplete', 'one-time-code');
  await page.getByLabel('Pairing code').fill('001234');
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await expect(page.getByText('This device is connected.', { exact: true })).toBeVisible();
}

for (const path of ['/', '/speech-to-text/']) {
  test(`pairing is remembered and never asks for a GitHub token at ${path}`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto(path === '/' ? path : `http://127.0.0.1:4181${path}`);
    await pair(page);
    await expect(page.getByLabel('GitHub token', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /remember/i })).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByText('This device is connected.', { exact: true })).toBeVisible();
    state.paused = true;
    await page.getByRole('button', { name: 'Speech to text', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('syncing is resting');
    await expect(page.getByLabel('Pairing code')).toHaveCount(0);
  });
}

for (const path of ['/', '/speech-to-text/']) {
  test(`requests an email code and pairs without persisting the email at ${path}`, async ({ page }) => {
    const state = await fixture(page);
    state.emailEnabled = true;
    await page.goto(path === '/' ? path : `http://127.0.0.1:4181${path}`);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const email = page.getByRole('combobox', { name: 'Email address', exact: true });
    await expect(email.locator('option')).toHaveText(['Choose your email address', 'dad@example.test', 'mum@example.test', 'sibling@example.test']);
    await expect(page.getByRole('button', { name: 'Email me a code', exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Email address', exact: true })).toHaveCount(0);
    await email.selectOption('dad@example.test');
    await page.getByRole('button', { name: 'Email me a code', exact: true }).click();
    await expect(page.getByText(/If this email is approved/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Send again in/ })).toBeDisabled();
    expect(state.emailRequests).toBe(1);
    await page.getByLabel('Pairing code').fill('001234');
    await page.getByRole('button', { name: 'Connect this device' }).click();
    await expect(page.getByText('This device is connected.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('dad@example.test');
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByText('This device is connected.', { exact: true })).toBeVisible();
    expect(state.emailRequests).toBe(1);
  });
}

test('keeps manual pairing available after email failure and never resends automatically', async ({ page }) => {
  const state = await fixture(page);
  state.emailEnabled = true;
  state.emailFailed = true;
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Email address', exact: true }).selectOption('dad@example.test');
  await page.getByRole('button', { name: 'Email me a code', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email codes are not available');
  await expect(page.getByRole('button', { name: /Send again in/ })).toBeDisabled();
  await page.getByLabel('Pairing code').fill('001234');
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await expect(page.getByText('This device is connected.', { exact: true })).toBeVisible();
  expect(state.emailRequests).toBe(1);
  expect(state.pairingRequests).toBe(1);
});

test('local edits survive a quota pause and reload, then share after recovery', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/'); await pair(page);
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByLabel('Shopping item', { exact: true }).fill('Romaine lettuce');
  state.paused = true;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Romaine lettuce', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('syncing is resting', { timeout: 10000 });
  expect(state.writes).toBe(0);
  await page.reload();
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(page.getByText('Romaine lettuce', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('syncing is resting', { timeout: 10000 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Pairing code')).toHaveCount(0);
  state.paused = false;
  // A reopen after recovery also retries the retained journal; no re-pair required.
  await page.reload();
  await expect.poll(() => state.items.some(item => item.text === 'Romaine lettuce'), { timeout: 10000 }).toBe(true);
  expect(state.writes).toBe(1);
});

test('revoked access offers a replacement code and preserves the connection on a bad replacement', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/'); await pair(page);
  state.revoked = true;
  await page.getByRole('button', { name: 'Speech to text', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Pairing code')).toBeVisible();
  state.badCode = true;
  await page.getByLabel('Pairing code').fill('005678');
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await expect(page.getByRole('alert')).toContainText('expired');
  const saved = await page.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/'));
  expect(saved).toMatch(/^device_/);
  state.badCode = false;
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await expect(page.getByText('This device is connected.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/'))).not.toBe(saved);
});

test('incomplete codes stay local and repeated pairing attempts respect the retry delay', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Pairing code').fill('12345');
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await expect(page.getByRole('alert')).toContainText('six-digit');
  expect(state.pairingRequests).toBe(0);
  state.limited = true;
  await page.getByLabel('Pairing code').fill('001 234');
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await expect(page.getByRole('alert')).toContainText('15 minutes');
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await expect(page.getByRole('alert')).toContainText('15 minutes');
  expect(state.pairingRequests).toBe(1);
  await page.getByRole('button', { name: 'Speech to text', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Speech to text', exact: true })).toHaveAttribute('aria-expanded', 'true');
});

test('previous long invitations can still be pasted', async ({ page }) => {
  await fixture(page); await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Pairing code').fill('AAAA-BBBB-CCCC-DDDD-EEEE');
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await expect(page.getByText('This device is connected.', { exact: true })).toBeVisible();
});
