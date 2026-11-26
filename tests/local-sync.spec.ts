import { refreshPlanners } from './navigation';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
test.use({ serviceWorkers: 'block' });
const listPath = 'shopping/list.json';
const weekPath = 'weeks/2026-10-19.json';
const breakfast = '2026-10-19/breakfast';
type Doc = { version: number; items?: { id: string; text: string; checked: boolean }[] | string[]; meals?: Record<string, string | null> };
async function fixture(context: BrowserContext) {
  const state = { documents: {
    [listPath]: { version: 1, items: [{ id: 'milk', text: 'Milk', checked: false }, { id: 'bread', text: 'Bread', checked: false }] },
    'shopping/regular-items.json': { version: 1, items: ['Milk', 'Bread', 'Eggs'] },
    [weekPath]: { version: 2, meals: { [breakfast]: 'Toast' } },
    'defaults.json': { version: 1, meals: {} },
  } as Record<string, Doc>, revision: 1, puts: 0, offline: false, hold: undefined as Promise<void> | undefined };
  await context.route('https://raw.githubusercontent.com/**', route => {
    const path = new URL(route.request().url()).pathname.split('/main/')[1]!;
    return route.fulfill({ status: state.offline ? 503 : 200, json: state.documents[path] ?? { version: 1, meals: {} } });
  });
  await context.route('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals**', async route => {
    if (!route.request().url().includes('/contents/')) return route.fulfill({ json: { permissions: { push: true } } });
    const path = new URL(route.request().url()).pathname.split('/contents/')[1]!;
    if (state.offline) return route.fulfill({ status: 503, json: {} });
    if (route.request().method() === 'PUT') {
      state.puts++;
      if (state.hold) await state.hold;
      const data = route.request().postDataJSON();
      if (data.sha !== String(state.revision)) return route.fulfill({ status: 409, json: {} });
      state.documents[path] = JSON.parse(Buffer.from(data.content, 'base64').toString()); state.revision++;
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: { sha: String(state.revision), encoding: 'base64', content: Buffer.from(JSON.stringify(state.documents[path] ?? { version: 1, meals: {} })).toString('base64') } });
  });
  return state;
}
async function open(page: Page, screen: 'Shopping list' | 'Meal planner') {
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  if (await page.getByLabel('GitHub token').isVisible()) {
    await page.getByLabel('GitHub token').fill('test-token');
    await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
    await expect(page.getByText('GitHub connected', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: screen, exact: true }).click();
}
const refresh = refreshPlanners;

test('completed edits save after a pause without Refresh and retry while another screen is open', async ({ page, context }) => {
  const state = await fixture(context); await open(page, 'Shopping list');
  await page.getByRole('checkbox', { name: 'Bought Milk', exact: true }).check();
  await expect.poll(() => state.documents[listPath]!.items).toContainEqual({ id: 'milk', text: 'Milk', checked: true });
  await expect(page.locator('.saving-indicator')).toHaveText('Saved');
  state.offline = true;
  await page.getByRole('checkbox', { name: 'Bought Bread', exact: true }).check();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.saving-indicator')).toContainText('waiting to share');
  state.offline = false;
  await expect.poll(() => state.documents[listPath]!.items, { timeout: 10000 }).toContainEqual({ id: 'bread', text: 'Bread', checked: true });
  await expect(page.locator('.saving-indicator')).toHaveText('Saved');
});

test('unresponsive device storage cannot trap navigation or prevent public planner reads', async ({ page, context }) => {
  await fixture(context);
  await context.addInitScript(() => {
    // Some browsers leave an IndexedDB open request pending without an error.
    Object.defineProperty(window, 'indexedDB', { value: { open: () => ({}) } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 1000 });
  // Last selection wins even when earlier navigation requests are still waiting.
  await page.evaluate(() => {
    for (const name of ['Shopping list', 'Meal planner', 'Speech to text']) {
      document.querySelector<HTMLButtonElement>(`.toolbar button[aria-label="${name}"]`)!.click();
    }
  });
  await expect(page.getByRole('region', { name: 'Live transcript' })).toBeVisible({ timeout: 1000 });
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shopping list', exact: true })).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole('checkbox', { name: 'Bought Milk', exact: true })).toBeVisible();
});

test('a stalled local write keeps edits in memory and all four screens reachable', async ({ page, context }) => {
  const state = await fixture(context); await open(page, 'Shopping list');
  await expect(page.getByRole('checkbox', { name: 'Bought Milk', exact: true })).toBeEnabled();
  state.offline = true;
  await page.evaluate(() => {
    Object.assign(window, { abortedPlannerWrite: false });
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[1] === 'readwrite') return {
        objectStore: () => ({ put() {}, delete() {} }),
        abort() { Object.assign(window, { abortedPlannerWrite: true }); },
      } as unknown as IDBTransaction;
      return transaction.apply(this, args);
    };
  });
  await page.getByRole('checkbox', { name: 'Bought Milk', exact: true }).check();
  for (const name of ['Meal planner', 'Settings', 'Speech to text', 'Shopping list']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }
  await expect(page.getByRole('checkbox', { name: 'Bought Milk', exact: true })).toBeChecked();
  await expect.poll(() => page.evaluate(() => (window as Window & { abortedPlannerWrite?: boolean }).abortedPlannerWrite)).toBe(true);
  await expect(page.locator('.saving-indicator')).toContainText('Changes are only in this open app');
  expect(await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(false);
  state.offline = false; await refresh(page);
  await expect.poll(() => state.documents[listPath]!.items).toContainEqual({ id: 'milk', text: 'Milk', checked: true });
});

test('shopping drafts recover after reload and reopening, and Cancel clears them without a shared write', async ({ page, context }) => {
  const state = await fixture(context); await open(page, 'Shopping list');
  await page.getByRole('button', { name: 'Edit Milk', exact: true }).click();
  await page.getByLabel('Shopping item', { exact: true }).fill('Unfinished milk wording');
  await expect(page.locator('.activity-status .saving-indicator')).toBeEmpty();
  await page.reload(); await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(page.getByLabel('Shopping item', { exact: true })).toHaveValue('Unfinished milk wording');
  expect(state.puts).toBe(0);
  await page.close();
  const reopened = await context.newPage(); await open(reopened, 'Shopping list');
  await expect(reopened.getByLabel('Shopping item', { exact: true })).toHaveValue('Unfinished milk wording');
  await reopened.getByRole('button', { name: 'Cancel', exact: true }).click();
  await reopened.reload(); await reopened.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(reopened.getByLabel('Shopping item', { exact: true })).toHaveCount(0);
  expect(state.puts).toBe(0);
});

test('a meal draft restores its week and scope after reload and detects a newer family default', async ({ page, context }) => {
  const state = await fixture(context); await open(page, 'Meal planner');
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ }).click();
  await page.locator('#meal-scope').selectOption('default');
  await page.locator('#meal-text').fill('Porridge draft');
  await page.reload(); await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.locator('#meal-text')).toHaveValue('Porridge draft');
  await expect(page.locator('#meal-scope')).toHaveValue('default');
  expect(state.puts).toBe(0);
  state.documents['defaults.json'] = { version: 1, meals: { 'monday/breakfast': 'Family eggs' } }; state.revision++;
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await refresh(page);
  await expect(page.getByRole('group', { name: 'Resolve Monday 26 Oct Breakfast weekly default' })).toContainText('Family eggs');
});

test('Undo restores a saved shopping deletion and its position, with visible sync status on mobile', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fixture(context); await open(page, 'Shopping list');
  await page.getByRole('button', { name: 'Delete Milk', exact: true }).click();
  await expect(page.locator('.saving-indicator')).toContainText('Saved on this device');
  await refresh(page);
  await expect.poll(() => state.documents[listPath]?.items).toEqual([{ id: 'bread', text: 'Bread', checked: false }]);
  await expect(page.locator('.saving-indicator')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.shopping-item-name')).toHaveText(['Milk', 'Bread']);
  await refresh(page);
  await expect.poll(() => state.documents[listPath]?.items).toEqual([{ id: 'milk', text: 'Milk', checked: false }, { id: 'bread', text: 'Bread', checked: false }]);
  await expect(page.locator('.shopping-undo')).toHaveCount(0);
});

test('editing and navigation continue during a shopping write; its response cannot erase newer edits', async ({ page, context }) => {
  const state = await fixture(context); await open(page, 'Shopping list');
  await expect(page.getByRole('checkbox', { name: 'Bought Milk', exact: true })).toBeEnabled();
  let release!: () => void;
  state.hold = new Promise<void>(resolve => { release = resolve; });
  await page.getByRole('checkbox', { name: 'Bought Milk', exact: true }).check();
  await refresh(page); await expect.poll(() => state.puts).toBe(1);
  await page.getByRole('checkbox', { name: 'Bought Milk', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Edit Milk', exact: true }).click();
  await page.getByLabel('Shopping item', { exact: true }).fill('Milk 2 bottles');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Bought Milk 2 bottles', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Speech to text', exact: true }).click();
  await expect(page.locator('#planner-panel')).toBeHidden();
  state.hold = undefined; release();
  await expect.poll(() => state.documents[listPath]!.items).toContainEqual({ id: 'milk', text: 'Milk 2 bottles', checked: false });
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Bought Milk 2 bottles', exact: true })).not.toBeChecked();
});

test('offline shopping edits survive reload and merge a family edit on reconnect', async ({ page, context }) => {
  const state = await fixture(context); await open(page, 'Shopping list');
  await expect(page.getByRole('checkbox', { name: 'Bought Milk', exact: true })).toBeEnabled();
  state.offline = true;
  await page.getByRole('checkbox', { name: 'Bought Milk', exact: true }).check();
  await page.getByRole('button', { name: 'Speech to text', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Bought Milk', exact: true })).toBeChecked();
  state.documents[listPath] = { version: 1, items: [{ id: 'milk', text: 'Milk 3 bottles', checked: false }, { id: 'bread', text: 'Bread', checked: false }] };
  state.revision++; state.offline = false;
  await refresh(page);
  await expect.poll(() => state.documents[listPath]!.items).toContainEqual({ id: 'milk', text: 'Milk 3 bottles', checked: true });
  await expect(page.getByRole('checkbox', { name: 'Bought Milk 3 bottles', exact: true })).toBeChecked();
});

test('conflicting shopping text is resolved per item while unrelated edits keep saving', async ({ page, context }) => {
  const state = await fixture(context); await open(page, 'Shopping list');
  await page.getByRole('button', { name: 'Edit Milk', exact: true }).click();
  await page.getByLabel('Shopping item', { exact: true }).fill('Milk 2 bottles');
  state.documents[listPath] = { version: 1, items: [{ id: 'milk', text: 'Milk 3 bottles', checked: false }, { id: 'bread', text: 'Bread', checked: false }] }; state.revision++;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Bought Bread', exact: true }).check();
  await refresh(page);
  const conflict = page.getByRole('group', { name: 'Resolve Milk 2 bottles', exact: true });
  await expect(conflict).toContainText('Family: Milk 3 bottles');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/shopping-conflict-${test.info().project.name}.png` });
  await expect.poll(() => state.documents[listPath]!.items).toContainEqual({ id: 'bread', text: 'Bread', checked: true });
  await conflict.getByRole('button', { name: 'Keep mine', exact: true }).click();
  await refresh(page);
  await expect.poll(() => state.documents[listPath]!.items).toContainEqual({ id: 'milk', text: 'Milk 2 bottles', checked: false });
  await expect(conflict).toHaveCount(0);
});

test('meal edits stay local through refresh, reload and a same-cell conflict', async ({ page, context }) => {
  const state = await fixture(context); await open(page, 'Meal planner');
  const cell = page.getByRole('button', { name: /^Monday 19 Oct, Breakfast:/ });
  await cell.click(); await page.locator('#meal-text').fill('Eggs');
  state.offline = true;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(cell).toContainText('Eggs');
  await page.getByRole('button', { name: 'Speech to text', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(cell).toContainText('Eggs');
  state.documents[weekPath] = { version: 2, meals: { [breakfast]: 'Porridge', '2026-10-19/dinner': 'Pasta' } }; state.revision++; state.offline = false;
  await refresh(page);
  const conflict = page.getByRole('group', { name: 'Resolve Monday 19 Oct Breakfast', exact: true });
  await expect(conflict).toContainText('Yours: Eggs');
  await expect(conflict).toContainText('Family: Porridge');
  await expect(page.getByRole('button', { name: /^Monday 19 Oct, Dinner:/ })).toContainText('Pasta');
  await conflict.getByRole('button', { name: 'Use family change', exact: true }).click();
  await expect(cell).toContainText('Porridge');
  await expect(conflict).toHaveCount(0);
});

test('two tabs keep each others pending edits and a refresh preserves an active text draft', async ({ page, context }) => {
  const state = await fixture(context); await open(page, 'Shopping list');
  const other = await context.newPage(); await open(other, 'Shopping list');
  state.offline = true;
  await page.getByRole('checkbox', { name: 'Bought Milk', exact: true }).check();
  await other.getByRole('checkbox', { name: 'Bought Bread', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Bought Bread', exact: true })).toBeChecked();
  await expect(other.getByRole('checkbox', { name: 'Bought Milk', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Edit Milk', exact: true }).click();
  await page.getByLabel('Shopping item', { exact: true }).fill('My unfinished wording');
  state.offline = false;
  await refresh(other);
  await expect(page.getByLabel('Shopping item', { exact: true })).toHaveValue('My unfinished wording');
  await expect.poll(() => state.documents[listPath]!.items).toEqual([{ id: 'milk', text: 'Milk', checked: true }, { id: 'bread', text: 'Bread', checked: true }]);
  await other.close();
});

test('an open shopping draft survives a family deletion and can explicitly restore the item', async ({ page, context }) => {
  const state = await fixture(context); await open(page, 'Shopping list');
  await page.getByRole('button', { name: 'Edit Milk', exact: true }).click();
  await page.getByLabel('Shopping item', { exact: true }).fill('Milk 2 bottles');
  state.documents[listPath] = { version: 1, items: [{ id: 'bread', text: 'Bread', checked: false }] }; state.revision++;
  await refresh(page);
  await expect(page.getByRole('checkbox', { name: 'Bought Milk', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Shopping item', { exact: true })).toHaveValue('Milk 2 bottles');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const conflict = page.getByRole('group', { name: 'Resolve Milk 2 bottles', exact: true });
  await expect(conflict).toContainText('Family: Removed');
  await conflict.getByRole('button', { name: 'Keep mine', exact: true }).click();
  await refresh(page);
  await expect.poll(() => state.documents[listPath]!.items).toContainEqual({ id: 'milk', text: 'Milk 2 bottles', checked: false });
});

test('blocked device storage keeps navigation available but prevents an unsafe app update', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new Error('Storage blocked'); } });
  });
  const state = await fixture(context); await open(page, 'Shopping list');
  await expect(page.getByRole('checkbox', { name: 'Bought Milk', exact: true })).toBeEnabled();
  state.offline = true;
  await page.getByRole('checkbox', { name: 'Bought Milk', exact: true }).check();
  await expect(page.getByRole('alert')).toContainText('could not keep changes on this device');
  expect(await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(false);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Update app', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved on this device or shared with your family');
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Bought Milk', exact: true })).toBeChecked();
  state.offline = false; await refresh(page);
  await expect.poll(() => state.documents[listPath]!.items).toContainEqual({ id: 'milk', text: 'Milk', checked: true });
});
