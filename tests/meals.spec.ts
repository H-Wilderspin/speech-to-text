import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// WebKit can bypass route fixtures in a service-worker-controlled second page.
// These tests mock GitHub; real offline-shell behavior is covered in app.spec.
test.use({ serviceWorkers: 'block' });

const week = '2026-10-19';
const key = `${week}/breakfast`;
async function fixture(context: BrowserContext) {
  const state = { meals: {} as Record<string, string | null>, defaults: {} as Record<string, string>,
    weeks: {} as Record<string, Record<string, string | null>>, failSave: false, saves: 0, revision: 1, defaultsRevision: 1 };
  const requestedWeek = (url: string) => url.match(/weeks\/(\d{4}-\d{2}-\d{2})\.json/)?.[1] ?? week;
  const document = (url: string) => url.includes('/defaults.json')
    ? { version: 1, meals: state.defaults }
    : { version: 2, meals: requestedWeek(url) === week ? state.meals : state.weeks[requestedWeek(url)] ?? {} };
  await context.route('https://raw.githubusercontent.com/H-Wilderspin/speech-to-text-meals/**', route => route.fulfill({ json: document(route.request().url()) }));
  await context.route('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals**', async route => {
    const request = route.request();
    if (!request.url().includes('/contents/')) return route.fulfill({ json: { permissions: { push: true } } });
    const isDefault = request.url().includes('/defaults.json');
    const revision = isDefault ? state.defaultsRevision : state.revision;
    if (request.method() === 'PUT') {
      state.saves++;
      if (state.failSave) return route.fulfill({ status: 503, json: {} });
      const body = request.postDataJSON();
      if (body.sha !== String(revision)) return route.fulfill({ status: 409, json: {} });
      const meals = JSON.parse(Buffer.from(body.content, 'base64').toString()).meals;
      if (isDefault) { state.defaults = meals; state.defaultsRevision++; }
      else {
        if (requestedWeek(request.url()) === week) state.meals = meals;
        else state.weeks[requestedWeek(request.url())] = meals;
        state.revision++;
      }
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: { sha: String(revision), encoding: 'base64', content: Buffer.from(JSON.stringify(document(request.url()))).toString('base64') } });
  });
  return state;
}
async function open(page: Page, url = '/') {
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(url);
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Plan updated');
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
}
async function planner(page: Page) {
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
}
async function connect(page: Page, remember = false) {
  await settings(page);
  await page.getByLabel('GitHub token').fill('test-only-token');
  if (remember) await page.getByRole('checkbox', { name: 'Remember on this device' }).check();
  await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
  await expect(page.getByText('GitHub connected', { exact: true })).toBeVisible();
  await planner(page);
}
const breakfast = (page: Page) => page.getByRole('button', { name: /^Monday 19 Oct, Breakfast:/ });
const split = (page: Page, mode: 'vertical' | 'horizontal') => page.getByRole('button', {
  name: mode === 'vertical' ? 'Vertical split (side by side)' : 'Horizontal split (stacked)', exact: true,
});

test('one Monday-first week, today marker, readable slots and project-path support', async ({ page, context }) => {
  await fixture(context);
  await open(page, 'http://127.0.0.1:4174/speech-to-text/');
  await expect(page.locator('.meal-day')).toHaveCount(7);
  await expect(page.locator('.meal-slot')).toHaveCount(21);
  await expect(page.locator('.meal-day').first()).toHaveAttribute('aria-current', 'date');
  await expect(page.locator('.meal-day').last()).toHaveAccessibleName('Sunday 25 Oct');
  await expect(breakfast(page)).toBeDisabled();
  await expect(page.getByLabel('GitHub token')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Remember on this device' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.locator('.meal-day').first()).toHaveAccessibleName('Monday 26 Oct');
  await expect(page.locator('[aria-current=date]')).toHaveCount(0);
  await page.getByRole('button', { name: 'This week', exact: true }).click();
  await expect(page.locator('.meal-day .today-marker')).toHaveText('Today');
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toBeFocused();
});

test('create, edit, share across pages, delete; session-only credentials are not persisted', async ({ page, context }) => {
  const state = await fixture(context);
  await open(page); await connect(page);
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Œufs & café');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast(page)).toContainText('Œufs & café');
  await expect(breakfast(page)).toBeFocused();
  expect(state.meals[key]).toBe('Œufs & café');
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Toast');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast(page)).toContainText('Toast');
  const reader = await context.newPage();
  await open(reader);
  await expect(breakfast(reader)).toContainText('Toast');
  await expect(breakfast(reader)).toBeDisabled();
  await reader.close();
  await breakfast(page).click();
  await page.getByRole('button', { name: 'Remove meal', exact: true }).click();
  await expect(breakfast(page)).toContainText('Add meal');
  expect(state.meals[key]).toBeNull();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('test-only-token');
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(page)).toBeEnabled();
  await settings(page);
  await page.getByRole('button', { name: 'Disconnect GitHub', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Disconnect', exact: true }).click();
  await planner(page);
  await expect(breakfast(page)).toBeDisabled();
  await connect(page);
  await expect(breakfast(page)).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(page)).toBeDisabled();
  await expect(page.getByText('To edit meals, connect GitHub in Settings.', { exact: true })).toBeVisible();
});

test('failed saves retain input; conflicting edits are not overwritten', async ({ page, context }) => {
  const state = await fixture(context);
  await open(page); await connect(page); await breakfast(page).click();
  await page.locator('#meal-text').fill('Porridge');
  state.failSave = true;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('did not save');
  await expect(page.locator('#meal-text')).toHaveValue('Porridge');
  state.failSave = false; state.meals[key] = 'Toast'; state.revision++;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Someone changed this meal');
  expect(state.meals[key]).toBe('Toast');
  expect(state.saves).toBe(1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(breakfast(page)).toContainText('Toast');
});

test('opening meals preserves listening and caption Clear does not clear meals', async ({ page, context }) => {
  const state = await fixture(context); state.meals[key] = 'Toast';
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void; onend?: () => void; onresult?: (event: unknown) => void;
      start() { Object.assign(window, { testRecognition: this }); this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { queueMicrotask(() => this.onend?.()); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await page.evaluate(() => {
    (window as Window & { testRecognition?: { onresult: (event: unknown) => void } }).testRecognition?.onresult({ results: [{ 0: { transcript: 'A caption.', confidence: .9 }, length: 1, isFinal: true }] });
  });
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(page)).toContainText('Toast');
  await split(page, 'horizontal').click();
  await expect(page.getByRole('dialog', { name: 'Meal planner' })).toHaveAttribute('aria-modal', 'false');
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('A caption.');
  await page.evaluate(() => {
    (window as Window & { testRecognition?: { onresult: (event: unknown) => void } }).testRecognition?.onresult({ resultIndex: 1, results: [
      { 0: { transcript: 'A caption.', confidence: .9 }, length: 1, isFinal: true },
      { 0: { transcript: 'Let us discuss toast.', confidence: .9 }, length: 1, isFinal: false },
    ] });
  });
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('Let us discuss toast.');
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('Let us discuss toast.');
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(split(page, 'horizontal')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('Tap Listen to start.');
  await expect(breakfast(page)).toContainText('Toast');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Close planner' }).click();
  await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(page)).toContainText('Toast');
  await expect(split(page, 'horizontal')).toHaveAttribute('aria-pressed', 'true');
});

test('combined view keeps both panes and controls usable at tablet and phone widths', async ({ page, context }) => {
  await fixture(context); await open(page);
  for (const width of [1280, 768, 767, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ['vertical', 'horizontal'] as const) {
    if (mode === 'vertical' && width < 768) {
      await expect(split(page, mode)).toBeDisabled();
      continue;
    }
    await expect(split(page, mode)).toBeEnabled();
    if (await split(page, mode).getAttribute('aria-pressed') !== 'true') await split(page, mode).click();
    await expect(split(page, mode)).toHaveAttribute('aria-pressed', 'true');
    await expect(split(page, mode === 'vertical' ? 'horizontal' : 'vertical')).toHaveAttribute('aria-pressed', 'false');
    const captions = await page.getByRole('region', { name: 'Live transcript' }).boundingBox();
    const meals = await page.getByRole('dialog', { name: 'Meal planner' }).boundingBox();
    const toolbar = await page.getByRole('contentinfo').boundingBox();
    expect(captions!.height).toBeGreaterThan(100);
    expect(meals!.height).toBeGreaterThan(200);
    if (mode === 'vertical') expect(captions!.x + captions!.width).toBeLessThanOrEqual(meals!.x);
    else expect(captions!.y + captions!.height).toBeLessThanOrEqual(meals!.y);
    expect(meals!.y + meals!.height).toBeLessThanOrEqual(toolbar!.y + 1);
    expect(await page.getByRole('dialog', { name: 'Meal planner' }).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page.locator('.week-heading')).toHaveText('26 Oct - 1 Nov, 2026');
    await page.getByRole('button', { name: 'Previous week' }).click();
    const groups = page.locator('.meal-header-actions');
    await expect(groups.nth(0).getByRole('button')).toHaveCount(2);
    await expect(groups.nth(1).getByRole('button')).toHaveCount(2);
    await expect(groups.nth(0).getByRole('button').nth(0)).toHaveAccessibleName('Close planner');
    await expect(groups.nth(0).getByRole('button').nth(1)).toHaveAccessibleName('Refresh');
    await page.screenshot({ path: `test-results/split-${mode}-${width}-${test.info().project.name}.png` });
    }
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Back to captions' }).click();
  await expect(split(page, 'horizontal')).toHaveAttribute('aria-pressed', 'true');
  await split(page, 'horizontal').click();
  await expect(page.getByRole('dialog', { name: 'Meal planner' })).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByRole('button', { name: 'Back to captions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close planner' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('switching planner layout preserves the selected week and unsaved meal', async ({ page, context }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await fixture(context); await open(page); await connect(page);
  await page.getByRole('button', { name: 'Next week' }).click();
  await page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ }).click();
  await page.locator('#meal-text').fill('Porridge and berries');
  await page.getByLabel('Apply to').selectOption('default');
  for (const mode of ['vertical', 'horizontal', 'horizontal', 'vertical'] as const) {
    await split(page, mode).click();
    await expect(page.locator('.week-heading')).toHaveText('26 Oct - 1 Nov, 2026');
    await expect(page.locator('#meal-text')).toHaveValue('Porridge and berries');
    await expect(page.getByLabel('Apply to')).toHaveValue('default');
    await expect(split(page, mode)).toBeFocused();
  }
  await page.setViewportSize({ width: 767, height: 900 });
  await expect(split(page, 'vertical')).toBeDisabled();
  await expect(split(page, 'horizontal')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.content-layout')).toHaveClass(/split-horizontal/);
  await expect(page.locator('#meal-text')).toHaveValue('Porridge and berries');
  await expect(page.locator('.week-heading')).toHaveText('26 Oct - 1 Nov, 2026');
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(split(page, 'vertical')).toBeEnabled();
  await expect(split(page, 'vertical')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.content-layout')).toHaveClass(/split-vertical/);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ })).toContainText('Porridge and berries');
  await expect(page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toBeFocused();
});

test('This week follows the current date when the planner stays open across Monday', async ({ page, context }) => {
  await fixture(context);
  await page.clock.install({ time: new Date('2026-10-25T23:59:30') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Plan updated');
  await page.clock.fastForward(60000);
  await page.getByRole('button', { name: 'This week', exact: true }).click();
  await expect(page.locator('.meal-day').first()).toHaveAccessibleName('Monday 26 Oct');
  await expect(page.locator('.meal-day').first()).toHaveAttribute('aria-current', 'date');
});

test('failed loads finish loading and Refresh recovers without clearing a displayed plan', async ({ page, context }) => {
  let offline = true;
  await context.route('https://raw.githubusercontent.com/H-Wilderspin/speech-to-text-meals/**', route => offline
    ? route.abort()
    : route.fulfill({ json: { version: 1, meals: route.request().url().includes('/defaults.json') ? {} : { [key]: 'Toast' } } }));
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Check your connection');
  await expect(page.getByText('Loading plan…', { exact: true })).toHaveCount(0);
  offline = false;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(breakfast(page)).toContainText('Toast');
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  offline = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Check your connection');
  await expect(breakfast(page)).toContainText('Toast');
});

test('automatic refresh preserves a draft and detects a newer edit before saving', async ({ page, context }) => {
  const state = await fixture(context);
  await page.clock.install({ time: new Date('2026-10-19T12:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Plan updated');
  await connect(page);
  await breakfast(page).click();
  await page.locator('#meal-text').fill('My breakfast');
  state.meals[key] = 'Family breakfast'; state.revision++;
  await page.clock.fastForward(60000);
  await expect(breakfast(page)).toContainText('Family breakfast');
  await expect(page.locator('#meal-text')).toHaveValue('My breakfast');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Someone changed this meal');
  expect(state.saves).toBe(0);
});

test('remembered access survives reload and reopening; Disconnect forgets it across tabs', async ({ page, context }) => {
  const state = await fixture(context);
  const url = 'http://127.0.0.1:4174/speech-to-text/';
  const savedKey = 'speech-to-text-meal-editor:/speech-to-text/';
  await open(page, url);
  await page.evaluate(() => {
    localStorage.setItem('speech-to-text-meal-editor:/other/', 'other-token');
    localStorage.setItem('speech-to-text-display:/speech-to-text/', JSON.stringify({ textSize: 40, language: 'en-GB' }));
  });
  await connect(page, true);
  await settings(page);
  await expect(page.getByText('Remembered on this device.', { exact: false })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), savedKey)).toBe('test-only-token');
  await page.reload();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(page)).toBeEnabled();
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Remembered breakfast');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast(page)).toContainText('Remembered breakfast');
  expect(state.meals[key]).toBe('Remembered breakfast');
  const reopened = await context.newPage();
  await open(reopened, url);
  await expect(breakfast(reopened)).toBeEnabled();
  await settings(reopened);
  await reopened.getByRole('button', { name: 'Disconnect GitHub', exact: true }).click();
  const confirmation = reopened.getByRole('alertdialog', { name: 'Disconnect GitHub?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole('button', { name: 'Keep connected' })).toBeFocused();
  expect(await reopened.evaluate(key => localStorage.getItem(key), savedKey)).toBe('test-only-token');
  await expect(breakfast(page)).toBeEnabled();
  await reopened.keyboard.press('Escape');
  await expect(confirmation).not.toBeVisible();
  await expect(reopened.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
  await expect(reopened.getByRole('button', { name: 'Disconnect GitHub', exact: true })).toBeFocused();
  await reopened.getByRole('button', { name: 'Disconnect GitHub', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Keep connected' }).click();
  await expect(confirmation).not.toBeVisible();
  expect(await reopened.evaluate(key => localStorage.getItem(key), savedKey)).toBe('test-only-token');
  await expect(breakfast(page)).toBeEnabled();
  await reopened.getByRole('button', { name: 'Disconnect GitHub', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(reopened.getByLabel('GitHub token')).toBeFocused();
  await planner(reopened);
  await expect(breakfast(reopened)).toBeDisabled();
  await expect(breakfast(page)).toBeDisabled();
  expect(await reopened.evaluate(key => localStorage.getItem(key), savedKey)).toBeNull();
  expect(await reopened.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/other/'))).toBe('other-token');
  expect(await reopened.evaluate(() => JSON.parse(localStorage.getItem('speech-to-text-display:/speech-to-text/')!).textSize)).toBe(40);
  await reopened.reload();
  await reopened.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(reopened)).toBeDisabled();
});

test('blocked storage allows session editing without claiming access was remembered', async ({ page, context }) => {
  await fixture(context);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await open(page);
  await connect(page, true);
  await expect(breakfast(page)).toBeEnabled();
  await settings(page);
  await expect(page.getByText('Connected for this session only. This browser could not remember access.', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(page)).toBeDisabled();
});

test('invalid tokens are not remembered and expired saved access can be disconnected', async ({ page, context }) => {
  await fixture(context);
  await context.route('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals**', route => route.fulfill({ status: 401, json: {} }));
  await open(page);
  await settings(page);
  await page.getByLabel('GitHub token').fill('expired-test-token');
  await page.getByRole('checkbox', { name: 'Remember on this device' }).check();
  await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('expired or is invalid');
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/'))).toBeNull();
  await page.evaluate(() => localStorage.setItem('speech-to-text-meal-editor:/', 'expired-test-token'));
  await page.reload();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('connect a new token');
  await expect(breakfast(page)).toBeDisabled();
  await settings(page);
  await page.getByRole('button', { name: 'Disconnect GitHub', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Disconnect', exact: true }).click();
  await planner(page);
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Plan updated');
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/'))).toBeNull();
});

test('Settings keeps a pending connection visible until it completes', async ({ page, context }) => {
  await fixture(context);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await context.route('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals', async route => {
    await pending;
    await route.fulfill({ json: { permissions: { push: true } } });
  });
  await open(page);
  await settings(page);
  await page.getByLabel('GitHub token').fill('test-only-token');
  await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
  try {
    await expect(page.getByRole('button', { name: 'Back to captions' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connecting…', exact: true })).toBeDisabled();
  } finally { release(); }
  await expect(page.getByText('GitHub connected', { exact: true })).toBeVisible();
  await planner(page);
  await expect(breakfast(page)).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Disconnect GitHub', exact: true })).toHaveCount(0);
});

test('weekly defaults repeat, share, allow a dated override and can be skipped or restored', async ({ page, context }) => {
  const state = await fixture(context);
  await open(page); await connect(page);
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Porridge');
  await page.getByLabel('Apply to').selectOption('default');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast(page)).toContainText('Porridge');
  await expect(breakfast(page)).toContainText('Weekly default');
  expect(state.defaults['monday/breakfast']).toBe('Porridge');
  expect(state.meals[key]).toBeUndefined();

  const reader = await context.newPage();
  await open(reader);
  await expect(breakfast(reader)).toContainText('Porridge');
  await expect(breakfast(reader)).toBeDisabled();
  await reader.close();

  await page.getByRole('button', { name: 'Next week' }).click();
  const nextBreakfast = page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ });
  await expect(nextBreakfast).toContainText('Porridge');
  await nextBreakfast.click();
  await expect(page.getByLabel('Apply to')).toHaveValue('date');
  await page.locator('#meal-text').fill('Eggs');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(nextBreakfast).toContainText('Eggs');
  await expect(nextBreakfast).not.toContainText('Weekly default');
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(breakfast(page)).toContainText('Porridge');

  await breakfast(page).click();
  await page.getByRole('button', { name: 'Skip this meal', exact: true }).click();
  await expect(breakfast(page)).toContainText('Add meal');
  expect(state.meals[key]).toBeNull();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(breakfast(page)).not.toContainText('Porridge');
  await breakfast(page).click();
  await page.getByRole('button', { name: 'Use weekly default', exact: true }).click();
  await expect(breakfast(page)).toContainText('Porridge');
  expect(state.meals[key]).toBeUndefined();

  await breakfast(page).click();
  await page.getByLabel('Apply to').selectOption('default');
  await page.getByRole('button', { name: 'Remove weekly default', exact: true }).click();
  await expect(breakfast(page)).toContainText('Add meal');
  expect(state.defaults['monday/breakfast']).toBeUndefined();
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(nextBreakfast).toContainText('Eggs');
});

test('default edits preserve dated meals and retain drafts on failure or conflict', async ({ page, context }) => {
  const state = await fixture(context);
  state.meals[key] = 'Eggs'; state.defaults['monday/breakfast'] = 'Porridge';
  await open(page); await connect(page); await breakfast(page).click();
  await page.getByLabel('Apply to').selectOption('default');
  await expect(page.getByText(/This date has its own entry/)).toBeVisible();
  await page.locator('#meal-text').fill('Toast');
  state.failSave = true;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('did not save');
  await expect(page.locator('#meal-text')).toHaveValue('Toast');
  state.failSave = false;
  state.defaults['monday/breakfast'] = 'Cereal'; state.defaultsRevision++;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Someone changed this weekly default');
  expect(state.defaults['monday/breakfast']).toBe('Cereal');
  expect(state.meals[key]).toBe('Eggs');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await breakfast(page).click();
  await page.getByLabel('Apply to').selectOption('default');
  await page.locator('#meal-text').fill('Toast');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast(page)).toBeFocused();
  await expect(breakfast(page)).toContainText('Eggs');
  expect(state.defaults['monday/breakfast']).toBe('Toast');
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ })).toContainText('Toast');
});
