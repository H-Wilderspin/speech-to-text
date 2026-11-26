import { refreshPlanners, toggleCurrentPanel } from './navigation';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { ShoppingItem } from '../src/features/shopping/items';

test.use({ serviceWorkers: 'block' });
const path = 'shopping/list.json';
const cataloguePath = 'shopping/regular-items.json';
const initial: ShoppingItem[] = [{ id: 'milk', text: 'Milk', checked: false }, { id: 'bread', text: 'Bread', checked: false }];
async function fixture(context: BrowserContext) {
  const state = { documents: { [cataloguePath]: { version: 1, items: ['Milk', 'Bread', 'Eggs'] } } as Record<string, unknown>,
    revisions: {} as Record<string, number>, reads: [] as string[], failSave: false, failRead: false, holdSave: undefined as Promise<void> | undefined };
  const filePath = (url: string) => new URL(url).pathname.split(url.includes('api.github.com') ? '/contents/' : '/main/')[1]!;
  await context.route('https://raw.githubusercontent.com/H-Wilderspin/speech-to-text-meals/**', route => {
    const file = filePath(route.request().url()); state.reads.push(file);
    return route.fulfill({ status: state.failRead ? 503 : state.documents[file] ? 200 : 404, json: state.documents[file] ?? {} });
  });
  await context.route('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals**', async route => {
    const req = route.request();
    if (!req.url().includes('/contents/')) return route.fulfill({ json: { permissions: { push: true } } });
    const file = filePath(req.url());
    if (req.method() === 'PUT') {
      if (state.holdSave) await state.holdSave;
      if (state.failSave) return route.fulfill({ status: 503, json: {} });
      const body = req.postDataJSON();
      if (body.sha !== (state.documents[file] ? String(state.revisions[file] ?? 1) : undefined)) return route.fulfill({ status: 409, json: {} });
      state.documents[file] = JSON.parse(Buffer.from(body.content, 'base64').toString());
      state.revisions[file] = (state.revisions[file] ?? 1) + 1;
      return route.fulfill({ json: {} });
    }
    state.reads.push(file);
    if (state.failRead) return route.fulfill({ status: 503, json: {} });
    if (!state.documents[file]) return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json: { sha: String(state.revisions[file] ?? 1), encoding: 'base64', content: Buffer.from(JSON.stringify(state.documents[file])).toString('base64') } });
  });
  return state;
}
const panel = (page: Page) => page.getByRole('region', { name: 'Shopping list' });
const editor = (page: Page) => page.getByRole('form', { name: 'Edit shopping item' });
const tick = (page: Page, text: string) => page.getByRole('checkbox', { name: `Bought ${text}`, exact: true });
const quick = (page: Page, text: string) => page.getByRole('button', { name: `${text} on shopping list`, exact: true });
const labels = (page: Page) => page.locator('.shopping-item-name');
const grip = (page: Page, text: string) => page.getByRole('button', { name: `Reorder ${text}`, exact: true });
async function enableSplit(page: Page) {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByRole('button', { name: 'Split view', exact: true }).click();
}
async function saveNow(page: Page) {
  await refreshPlanners(page);
  await expect(panel(page).getByRole('status', { name: 'Shopping updates' })).toHaveText('Shopping list updated');
}
async function keyboardMove(page: Page, text: string, key: string) {
  await grip(page, text).press('Space');
  await page.keyboard.press(key);
  await page.keyboard.press('Enter');
}
async function dragItem(page: Page, text: string, target: string, edge: 'before' | 'after') {
  const name = labels(page).filter({ hasText: new RegExp(`^${text}$`) });
  await name.scrollIntoViewIfNeeded();
  const source = (await name.boundingBox())!;
  const destination = (await tick(page, target).locator('..').locator('..').boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x + destination.width / 2, edge === 'before' ? destination.y + 12 : destination.y + destination.height - 12, { steps: 8 });
  await page.mouse.up();
}
async function open(page: Page, connected = false, base = '/') {
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(base);
  if (connected) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('GitHub token').fill('test-only-token');
    await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
    await expect(page.getByText('GitHub connected', { exact: true })).toBeVisible();
    await toggleCurrentPanel(page);
  }
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(panel(page).getByRole('status', { name: 'Shopping updates' })).toHaveText('Shopping list updated');
}

test('anonymous reading, responsive splits and shopping toggle work at the project path', async ({ page, context }) => {
  const state = await fixture(context); state.documents[path] = { version: 1, items: initial };
  await open(page, false, 'http://127.0.0.1:4174/speech-to-text/');
  await expect(tick(page, 'Milk')).toBeDisabled();
  await expect(grip(page, 'Milk')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete Milk', exact: true })).toBeDisabled();
  await expect(quick(page, 'Eggs')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next week', exact: true })).toBeHidden();
  expect(state.reads.every(file => file.startsWith('shopping/'))).toBe(true);
  for (const width of [1280, 768, 767, 390, 320, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const button = page.getByRole('button', { name: 'Split view', exact: true });
    if (width < 768) {
      await expect(button).toHaveCount(0);
      await expect(panel(page)).not.toHaveAttribute('aria-modal');
      await expect(page.locator('.content-layout')).not.toHaveClass(/with-meals/);
    } else {
      if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
      await expect(page.getByRole('region', { name: 'Live transcript' })).toBeVisible();
      const captions = (await page.getByRole('region', { name: 'Live transcript' }).boundingBox())!;
      const shopping = (await panel(page).boundingBox())!;
      expect(captions.x + captions.width).toBeLessThanOrEqual(shopping.x);
    }
    expect(await panel(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/shopping-${width}-${test.info().project.name}.png` });
  }
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(page.locator('.app-panel:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Shopping list', exact: true })).toBeFocused();
});

test('Add item stays at the panel bottom for short and scrolling lists in full and split views', async ({ page, context }) => {
  const state = await fixture(context);
  state.documents[path] = { version: 1, items: [] };
  await page.setViewportSize({ width: 1280, height: 700 });
  await open(page, true);
  const add = page.getByRole('button', { name: 'Add item', exact: true });
  const expectFooter = async () => {
    await expect(add).toBeInViewport();
    const pane = (await panel(page).boundingBox())!;
    const button = (await add.boundingBox())!;
    expect(pane.y + pane.height - button.y - button.height).toBeCloseTo(12, 0);
    expect(button.x).toBeGreaterThanOrEqual(pane.x);
    expect(button.x + button.width).toBeLessThanOrEqual(pane.x + pane.width);
  };
  await expectFooter();
  state.documents[path] = { version: 1, items: Array.from({ length: 25 }, (_, i) => ({ id: `item-${i}`, text: `Item ${i}`, checked: false })) };
  await saveNow(page);
  for (const width of [1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 700 });
    if (width === 1024) await page.getByRole('button', { name: 'Split view', exact: true }).click();
    for (const position of [0, 500, 100000]) {
      await panel(page).evaluate((el, top) => { el.scrollTop = top; }, position);
      await expectFooter();
    }
  }
  await add.click();
  await expect(page.getByLabel('Shopping item', { exact: true })).toBeFocused();
  await page.getByLabel('Shopping item', { exact: true }).fill('Apples');
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(add).toBeFocused();
  await expectFooter();
  await expect(tick(page, 'Apples')).toBeVisible();
});

test('local ticks and saves keep the list position stable and preserve checkbox focus', async ({ page, context }) => {
  const state = await fixture(context); state.documents[path] = { version: 1, items: initial };
  await page.clock.install({ time: new Date('2026-10-19T12:00:00') });
  await open(page, true);
  const top = async () => (await page.getByRole('button', { name: 'Add item', exact: true }).boundingBox())!.y;
  const before = await top();
  await tick(page, 'Milk').focus();
  await page.keyboard.press('Space');
  await expect(tick(page, 'Milk')).toBeChecked();
  await expect(tick(page, 'Milk')).toBeFocused();
  expect(await top()).toBeCloseTo(before, 0);
  expect(state.revisions[path]).toBeUndefined();
  await page.clock.fastForward(30000);
  await expect(panel(page).getByRole('status', { name: 'Shopping updates' })).toHaveText('Shopping list saved');
  expect(await top()).toBeCloseTo(before, 0);
});

test('regular item toggles keep focus in the catalogue without jumping into the main list', async ({ page, context }) => {
  const state = await fixture(context);
  state.documents[path] = { version: 1, items: Array.from({ length: 20 }, (_, i) => ({ id: `item-${i}`, text: `Item ${i}`, checked: false })) };
  await open(page, true);
  await page.setViewportSize({ width: 390, height: 650 });
  await quick(page, 'Milk').click();
  await expect(quick(page, 'Milk')).toBeFocused();
  await expect(quick(page, 'Milk')).toBeInViewport();
  await expect(quick(page, 'Bread')).toBeInViewport();
  await quick(page, 'Bread').click();
  await expect(quick(page, 'Bread')).toBeFocused();
  await expect(quick(page, 'Bread')).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(labels(page)).toHaveCount(21);
  await expect(quick(page, 'Bread')).toHaveAttribute('aria-pressed', 'false');
  await expect(quick(page, 'Bread')).toBeFocused();
  await expect(quick(page, 'Bread')).toBeInViewport();
  await page.keyboard.press('Space');
  await expect(labels(page)).toHaveCount(22);
  await expect(quick(page, 'Bread')).toHaveAttribute('aria-pressed', 'true');
  expect(state.revisions[path]).toBeUndefined();
});

test('regular item deselection removes matching bought items locally and saves on close', async ({ page, context }) => {
  const state = await fixture(context);
  state.documents[path] = { version: 1, items: [
    { id: 'milk', text: 'MILK', checked: true },
    { id: 'quantity', text: 'Milk — 2', checked: false },
  ] };
  await open(page, true);
  await expect(quick(page, 'Milk')).toHaveAttribute('aria-pressed', 'true');
  await quick(page, 'Milk').click();
  await expect(labels(page)).toHaveText(['Milk — 2']);
  await expect(quick(page, 'Milk')).toHaveAttribute('aria-pressed', 'false');
  await expect(quick(page, 'Milk')).toBeFocused();
  expect(state.revisions[path]).toBeUndefined();
  await toggleCurrentPanel(page);
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(() => state.documents[path]).toEqual({ version: 1, items: [{ id: 'quantity', text: 'Milk — 2', checked: false }] });
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(labels(page)).toHaveText(['Milk — 2']);
  await quick(page, 'Milk').click();
  await expect(labels(page)).toHaveText(['Milk — 2', 'Milk']);
  await expect(tick(page, 'Milk')).not.toBeChecked();
});

test('custom CRUD, bought ticks, order and quick-add persist across devices', async ({ page, context }) => {
  const state = await fixture(context); await open(page, true);
  await expect(page.getByText('Your shopping list is empty.')).toBeVisible();
  await quick(page, 'Milk').click(); await expect(tick(page, 'Milk')).toBeVisible();
  await expect(quick(page, 'Milk')).toHaveAttribute('aria-pressed', 'true');
  await quick(page, 'Bread').click(); await expect(tick(page, 'Bread')).toBeVisible();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByLabel('Shopping item', { exact: true }).fill('Apples — 6');
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(labels(page)).toHaveText(['Milk', 'Bread', 'Apples — 6']);
  await dragItem(page, 'Apples — 6', 'Bread', 'before');
  await expect(labels(page)).toHaveText(['Milk', 'Apples — 6', 'Bread']);
  await keyboardMove(page, 'Milk', 'ArrowDown');
  await expect(labels(page)).toHaveText(['Apples — 6', 'Milk', 'Bread']);
  await expect(grip(page, 'Milk')).toBeFocused();
  await tick(page, 'Milk').click(); await expect(tick(page, 'Milk')).toBeChecked();
  await tick(page, 'Milk').click(); await expect(tick(page, 'Milk')).not.toBeChecked();
  await page.getByRole('button', { name: 'Edit Apples — 6', exact: true }).click();
  await page.getByLabel('Shopping item', { exact: true }).fill('Apples — 4');
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(tick(page, 'Apples — 4')).toBeVisible();
  expect(state.revisions[path]).toBeUndefined();
  await saveNow(page);
  const other = await context.newPage(); await open(other);
  await expect(labels(other)).toHaveText(['Apples — 4', 'Milk', 'Bread']);
  await page.getByRole('button', { name: 'Delete Milk', exact: true }).click();
  await expect(tick(page, 'Milk')).toHaveCount(0); await expect(quick(page, 'Milk')).toBeEnabled();
  await saveNow(page);
  await refreshPlanners(other);
  await expect(labels(other)).toHaveText(['Apples — 4', 'Bread']);
  await other.close();
  expect(Object.keys(state.documents).sort()).toEqual([path, cataloguePath].sort());
});

test('the supplied household catalogue is available without a data file and malformed lists cannot be overwritten', async ({ page, context }) => {
  const state = await fixture(context); delete state.documents[cataloguePath];
  await open(page, true);
  await expect(page.locator('.shopping-quick-add button')).toHaveCount(25);
  await expect(quick(page, 'Volila 60x90 puppy pads')).toBeEnabled();
  await expect(quick(page, 'Semi skimmed milk')).toBeEnabled();
  await expect(quick(page, 'Cornish gold top milk')).toBeEnabled();
  await expect(quick(page, 'Coffee')).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: `test-results/shopping-catalogue-${test.info().project.name}.png` });
  await quick(page, 'Volila 60x90 puppy pads').click();
  await expect(tick(page, 'Volila 60x90 puppy pads')).toBeVisible();
  await expect(quick(page, 'Volila 60x90 puppy pads')).toHaveAttribute('aria-pressed', 'true');
  await saveNow(page);
  state.documents[path] = { version: 9, items: [] };
  await page.reload();
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(panel(page).getByRole('alert')).toContainText('unsupported');
  await expect(page.getByRole('button', { name: 'Add item', exact: true })).toBeEnabled();
  await expect(tick(page, 'Volila 60x90 puppy pads')).toBeVisible();
  await tick(page, 'Volila 60x90 puppy pads').click();
  await refreshPlanners(page);
  await expect(panel(page).getByRole('alert')).toContainText('unsupported');
  expect(state.documents[path]).toEqual({ version: 9, items: [] });
  state.documents[path] = { version: 1, items: [] };
  await refreshPlanners(page);
  await expect(page.getByRole('button', { name: 'Add item', exact: true })).toBeEnabled();
});

test('failed batches retain local changes and conflicts offer a reviewed merge', async ({ page, context }) => {
  const state = await fixture(context); state.documents[path] = { version: 1, items: initial };
  await page.clock.install({ time: new Date('2026-10-19T12:00:00') }); await open(page, true);
  state.failSave = true;
  await tick(page, 'Milk').click(); await expect(tick(page, 'Milk')).toBeChecked();
  await keyboardMove(page, 'Milk', 'ArrowDown');
  expect(state.revisions[path]).toBeUndefined();
  await page.clock.fastForward(30000);
  await expect(panel(page).getByRole('alert')).toContainText('did not save');
  await expect(labels(page)).toHaveText(['Bread', 'Milk']);
  await page.getByRole('button', { name: 'Edit Milk', exact: true }).click();
  await page.getByLabel('Shopping item', { exact: true }).fill('My milk');
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  state.failSave = false;
  state.documents[path] = { version: 1, items: [{ ...initial[0], text: 'Oat milk' }, initial[1], { id: 'eggs', text: 'Eggs', checked: false }] }; state.revisions[path] = 2;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(labels(page)).toHaveText(['Bread', 'My milk', 'Eggs']);
  await page.clock.fastForward(30000);
  await expect(page.getByRole('group', { name: 'Resolve My milk' })).toContainText('Oat milk');
  await page.getByRole('button', { name: 'Keep mine', exact: true }).click();
  await page.clock.fastForward(2000);
  await expect(panel(page).getByRole('status', { name: 'Shopping updates' })).toHaveText('Shopping list saved');
  await expect(labels(page)).toHaveText(['Bread', 'My milk', 'Eggs']);
  await expect(tick(page, 'My milk')).toBeChecked();
  state.failRead = true;
  await refreshPlanners(page);
  await expect(panel(page).getByRole('alert')).toBeVisible();
  await expect(tick(page, 'My milk')).toBeVisible();
  state.failRead = false;
  await refreshPlanners(page);
  await expect(panel(page).getByRole('alert')).toHaveCount(0);
  await enableSplit(page);
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  const reads = state.reads.filter(file => file.startsWith('shopping/')).length;
  await page.clock.fastForward(60000);
  expect(state.reads.filter(file => file.startsWith('shopping/')).length).toBe(reads);
});

for (const split of [false, true]) test(`meal and shopping drafts survive footer switches (${split ? 'split' : 'full'}) and editing stops listening while keeping captions`, async ({ page, context }) => {
  const state = await fixture(context);
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void; onend?: () => void; onresult?: (event: unknown) => void;
      start() { Object.assign(window, { testRecognition: this }); this.onstart?.(); }
      stop() { this.onend?.(); } abort() { Object.assign(window, { wasAborted: true }); queueMicrotask(() => this.onend?.()); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await open(page, true);
  if (split) await enableSplit(page);
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await page.evaluate(() => {
    (window as Window & { testRecognition?: { onresult: (event: unknown) => void } }).testRecognition?.onresult({ results: [{ 0: { transcript: 'We need apples.', confidence: .9 }, length: 1, isFinal: true }] });
  });
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as Window & { wasAborted?: boolean }).wasAborted)).toBe(true);
  await page.getByLabel('Shopping item', { exact: true }).fill('Shopping draft');
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await page.getByRole('button', { name: /^Monday 19 Oct, Breakfast:/ }).click();
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  await page.locator('#meal-text').fill('Meal draft');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Settings', exact: true })).toBeVisible();
  await expect(panel(page)).toBeHidden();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.app-panel:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.locator('#meal-text')).toHaveValue('Meal draft');
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(page.getByLabel('Shopping item', { exact: true })).toHaveValue('Shopping draft');
  await expect(page.locator('.transcript')).toContainText('We need apples.');
  if (!split) await expect(page.locator('.transcript')).toBeHidden();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  let release!: () => void; state.holdSave = new Promise<void>(resolve => { release = resolve; });
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(tick(page, 'Shopping draft')).toBeVisible();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  try {
    const navigation = ['Meal planner', 'Shopping list', 'Settings'];
    if (page.viewportSize()!.width >= 768) navigation.push('Split view');
    else await expect(page.getByRole('button', { name: 'Split view', exact: true })).toHaveCount(0);
    for (const name of navigation) {
      await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
    }
    await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  } finally { release(); }
  await expect(page.locator('#meal-text')).toHaveValue('Meal draft');
  expect(state.reads.some(file => file.startsWith('cleaning/'))).toBe(false);
  await page.reload();
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(tick(page, 'Shopping draft')).toBeEnabled();
});

test('dragging moves across positions once and keyboard pickup supports boundaries and cancellation', async ({ page, context }) => {
  const state = await fixture(context);
  const items = [...initial, { id: 'eggs', text: 'Eggs', checked: true }];
  state.documents[path] = { version: 1, items }; await open(page, true);
  await dragItem(page, 'Milk', 'Eggs', 'after');
  await expect(labels(page)).toHaveText(['Bread', 'Eggs', 'Milk']);
  expect(state.revisions[path]).toBeUndefined();
  await expect(tick(page, 'Eggs')).toBeChecked();
  await dragItem(page, 'Milk', 'Bread', 'before');
  await expect(labels(page)).toHaveText(['Milk', 'Bread', 'Eggs']);
  expect(state.revisions[path]).toBeUndefined();
  await grip(page, 'Milk').press('Space');
  await page.keyboard.press('ArrowUp');
  await expect(panel(page).getByRole('status', { name: 'Shopping updates' })).toContainText('Position 1 of 3');
  await page.keyboard.press('End');
  await expect(panel(page).getByRole('status', { name: 'Shopping updates' })).toContainText('Position 3 of 3');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeVisible();
  await expect(labels(page)).toHaveText(['Milk', 'Bread', 'Eggs']);
  expect(state.revisions[path]).toBeUndefined();
  await keyboardMove(page, 'Eggs', 'Home');
  await expect(labels(page)).toHaveText(['Eggs', 'Milk', 'Bread']);
  await expect(grip(page, 'Eggs')).toBeFocused();
  const source = (await grip(page, 'Eggs').boundingBox())!;
  await page.mouse.move(source.x + 24, source.y + 24); await page.mouse.down();
  await page.mouse.move(0, 0, { steps: 5 }); await page.mouse.up();
  await expect(grip(page, 'Eggs')).toHaveAttribute('aria-pressed', 'false');
  expect(state.revisions[path]).toBeUndefined();
  await grip(page, 'Eggs').evaluate(el => el.addEventListener('pointerdown', event => { (el as HTMLElement).dataset.testPointerId = String((event as PointerEvent).pointerId); }, { once: true }));
  await page.mouse.move(source.x + 24, source.y + 24); await page.mouse.down();
  await page.mouse.move(source.x + 24, source.y + 48);
  await grip(page, 'Eggs').evaluate(el => el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: Number((el as HTMLElement).dataset.testPointerId) })));
  await page.mouse.up();
  await expect(grip(page, 'Eggs')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.refresh-button')).toBeEnabled();
  expect(state.revisions[path]).toBeUndefined();
  await saveNow(page);
  await expect.poll(() => state.revisions[path]).toBe(2);
});

test('quick delete updates locally, retains failed batches and protects concurrent changes', async ({ page, context }) => {
  const state = await fixture(context); state.documents[path] = { version: 1, items: initial };
  await open(page, true); state.failSave = true;
  await page.getByRole('button', { name: 'Delete Milk', exact: true }).click();
  await expect(tick(page, 'Milk')).toHaveCount(0);
  await expect(quick(page, 'Milk')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Edit Bread', exact: true })).toBeFocused();
  await expect(grip(page, 'Bread')).toBeDisabled();
  await refreshPlanners(page);
  await expect(panel(page).getByRole('alert')).toContainText('did not save');
  await expect(panel(page)).toBeVisible();
  await expect(labels(page)).toHaveText(['Bread']);
  state.failSave = false;
  state.documents[path] = { version: 1, items: [{ ...initial[0], checked: true }, initial[1]] }; state.revisions[path] = 2;
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Resolve Milk' })).toContainText('Milk (bought)');
  await page.getByRole('button', { name: 'Keep mine', exact: true }).click();
  await expect(panel(page).getByRole('status', { name: 'Shopping updates' })).toHaveText('Shopping list saved');
  await expect(tick(page, 'Milk')).toHaveCount(0);
  await expect(quick(page, 'Milk')).toBeEnabled();
  await page.getByRole('button', { name: 'Delete Bread', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add item', exact: true })).toBeFocused();
  await expect(page.getByText('Your shopping list is empty.')).toBeVisible();
  await saveNow(page);
});

test('a long list scrolls during dragging and queues the dropped order', async ({ page, context }) => {
  const state = await fixture(context);
  const items = Array.from({ length: 12 }, (_, i) => ({ id: `item-${i}`, text: `Item ${i + 1}`, checked: false }));
  state.documents[path] = { version: 1, items }; await open(page, true);
  await enableSplit(page);
  await page.setViewportSize({ width: 768, height: 600 });
  await grip(page, 'Item 1').scrollIntoViewIfNeeded();
  const source = (await grip(page, 'Item 1').boundingBox())!;
  const pane = (await panel(page).boundingBox())!;
  await page.mouse.move(source.x + 24, source.y + 24); await page.mouse.down();
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height - 12, { steps: 5 });
  await expect(panel(page).getByRole('status', { name: 'Shopping updates' })).toContainText('Position 12 of 12');
  expect(state.revisions[path]).toBeUndefined();
  const reads = state.reads.length;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(state.reads.length).toBe(reads);
  await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toBeDisabled();
  await page.screenshot({ path: `test-results/shopping-drag-${test.info().project.name}.png` });
  await page.mouse.up();
  await expect(labels(page).last()).toHaveText('Item 1');
  await expect(grip(page, 'Item 1')).toBeFocused();
  expect(state.revisions[path]).toBeUndefined();
  await saveNow(page);
  await expect.poll(() => state.revisions[path]).toBe(2);
  expect((state.documents[path] as { items: ShoppingItem[] }).items.at(-1)?.id).toBe('item-0');
});

test('the row background drags while checkbox, edit and delete retain their actions', async ({ page, context }) => {
  const state = await fixture(context); state.documents[path] = { version: 1, items: initial };
  await open(page, true);
  const row = tick(page, 'Milk').locator('..').locator('..');
  const source = (await row.boundingBox())!;
  const target = (await tick(page, 'Bread').locator('..').locator('..').boundingBox())!;
  await page.mouse.move(source.x + 5, source.y + 5); await page.mouse.down();
  await page.mouse.move(target.x + 12, target.y + target.height - 10, { steps: 5 }); await page.mouse.up();
  await expect(labels(page)).toHaveText(['Bread', 'Milk']);
  await expect(tick(page, 'Milk')).not.toBeChecked();
  await tick(page, 'Milk').click();
  await expect(tick(page, 'Milk')).toBeChecked();
  await expect(page.locator('.shopping-dragging')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Milk', exact: true }).click();
  await expect(editor(page)).toBeVisible();
  await editor(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Milk', exact: true }).click();
  await expect(labels(page)).toHaveText(['Bread']);
  expect(state.revisions[path]).toBeUndefined();
});

test('releasing or cancelling a touch hold clears pickup and its timer', async ({ page, context }) => {
  const state = await fixture(context); state.documents[path] = { version: 1, items: initial };
  await page.clock.install({ time: new Date('2026-10-19T12:00:00') });
  await open(page, true);
  await page.clock.pauseAt(new Date('2026-10-19T13:00:00'));
  const start = () => labels(page).filter({ hasText: /^Milk$/ }).evaluate(el => {
    const rect = el.getBoundingClientRect();
    const event = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: [{ identifier: 1, clientX: rect.x + 10, clientY: rect.y + 10 }] });
    el.dispatchEvent(event);
  });
  await start(); await page.clock.fastForward(349);
  await expect(page.locator('.shopping-dragging')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('touchend')));
  await page.clock.fastForward(400);
  await expect(page.locator('.shopping-dragging')).toHaveCount(0);
  await expect(page.locator('.refresh-button')).toBeEnabled();
  await start(); await page.clock.fastForward(350);
  await expect(grip(page, 'Milk')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.dispatchEvent(new Event('touchcancel')));
  await expect(grip(page, 'Milk')).toHaveAttribute('aria-pressed', 'false');
  await start(); await page.keyboard.press('Escape'); await page.clock.fastForward(400);
  await expect(panel(page)).toBeVisible();
  await toggleCurrentPanel(page);
  await expect(page.locator('.shopping-dragging')).toHaveCount(0);
  await expect(page.locator('.app-panel:visible')).toHaveCount(0);
  expect(state.revisions[path]).toBeUndefined();
});

test('native touch gestures reorder from the item name without a drag icon', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native touch movement uses Chromium CDP; physical Safari touch remains a manual check.');
  const state = await fixture(context); state.documents[path] = { version: 1, items: initial };
  await open(page, true); await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const source = (await grip(page, 'Milk').boundingBox())!;
  await expect(page.locator('.shopping-actions').first().getByRole('button')).toHaveCount(2);
  const target = (await tick(page, 'Bread').locator('..').locator('..').boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: source.x + 24, y: source.y + 24, id: 1 }] });
  await expect(grip(page, 'Milk')).toHaveAttribute('aria-pressed', 'true');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height - 12, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(labels(page)).toHaveText(['Bread', 'Milk']);
  await expect(grip(page, 'Milk')).toHaveAttribute('aria-pressed', 'false');
  expect(state.revisions[path]).toBeUndefined();
  await saveNow(page);
  await expect.poll(() => state.revisions[path]).toBe(2);
});

test('native touch holds drag the row text and ordinary swipes still scroll', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native touch movement uses Chromium CDP; physical Safari touch remains a manual check.');
  const state = await fixture(context);
  const items = Array.from({ length: 12 }, (_, i) => ({ id: `item-${i}`, text: `Item ${i + 1}`, checked: false }));
  state.documents[path] = { version: 1, items };
  await open(page, true); await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const first = labels(page).filter({ hasText: /^Item 1$/ });
  await first.scrollIntoViewIfNeeded();
  const source = (await first.boundingBox())!;
  const target = (await tick(page, 'Item 2').locator('..').locator('..').boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: source.x + 20, y: source.y + 10, id: 1 }] });
  await expect(grip(page, 'Item 1')).toHaveAttribute('aria-pressed', 'true');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x + 80, y: target.y + target.height - 12, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(labels(page).first()).toHaveText('Item 2');
  await expect(labels(page).nth(1)).toHaveText('Item 1');
  await expect(tick(page, 'Item 1')).not.toBeChecked();
  // Starting to move immediately cancels pickup and lets the browser scroll.
  await tick(page, 'Item 3').scrollIntoViewIfNeeded();
  const swipe = (await labels(page).filter({ hasText: /^Item 3$/ }).boundingBox())!;
  const before = await panel(page).evaluate(el => el.scrollTop);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: swipe.x + 20, y: swipe.y + 10, id: 1 }] });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: swipe.x + 20, y: swipe.y + 10 - i * 25, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => panel(page).evaluate(el => el.scrollTop)).toBeGreaterThan(before + 20);
  await expect(page.locator('.shopping-dragging')).toHaveCount(0);
  await expect(page.locator('.refresh-button')).toBeEnabled();
  await expect(labels(page).first()).toHaveText('Item 2');
  expect(state.revisions[path]).toBeUndefined();
});

test('local edits batch after two seconds of inactivity; clean and net-zero changes do not write', async ({ page, context }) => {
  const state = await fixture(context);
  await page.clock.install({ time: new Date('2026-10-19T12:00:00') });
  await open(page, true);
  await quick(page, 'Milk').click(); await quick(page, 'Bread').click(); await quick(page, 'Eggs').click();
  await tick(page, 'Milk').click();
  await keyboardMove(page, 'Eggs', 'Home');
  await expect(labels(page)).toHaveText(['Eggs', 'Milk', 'Bread']);
  await expect(tick(page, 'Milk')).toBeChecked();
  await expect(panel(page).getByRole('status', { name: 'Shopping updates' })).toContainText('Changes waiting to save');
  expect(state.revisions[path]).toBeUndefined();
  await page.clock.fastForward(1000);
  expect(state.revisions[path]).toBeUndefined();
  await page.clock.fastForward(1000);
  await expect.poll(() => state.revisions[path]).toBe(2);
  await expect(panel(page).getByRole('status', { name: 'Shopping updates' })).toHaveText('Shopping list saved');
  expect((state.documents[path] as { items: ShoppingItem[] }).items.map(item => item.text)).toEqual(['Eggs', 'Milk', 'Bread']);
  await page.clock.fastForward(30000);
  await expect.poll(() => state.revisions[path]).toBe(2);
  await tick(page, 'Milk').click(); await tick(page, 'Milk').click();
  await page.clock.fastForward(30000);
  await expect.poll(() => state.revisions[path]).toBe(2);
});

for (const way of ['toggle', 'split-toggle', 'meals', 'settings', 'captions']) test(`footer navigation via ${way} starts a background save when leaving shopping`, async ({ page, context }) => {
  const state = await fixture(context); await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, true);
  if (way === 'split-toggle') await enableSplit(page);
  await quick(page, 'Eggs').click();
  expect(state.revisions[path]).toBeUndefined();
  const destination = way === 'meals' ? 'Meal planner' : way === 'settings' ? 'Settings' : way === 'captions' ? 'Speech to text' : 'Shopping list';
  await page.getByRole('contentinfo').getByRole('button', { name: destination, exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(() => state.revisions[path]).toBe(2);
  await expect(page.getByRole('contentinfo').getByRole('button', { name: destination, exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(tick(page, 'Eggs')).toBeVisible();
});

test('discarding a conflicting local batch loads the reviewed shared list', async ({ page, context }) => {
  const state = await fixture(context); state.documents[path] = { version: 1, items: initial };
  await open(page, true);
  await page.getByRole('button', { name: 'Delete Milk', exact: true }).click();
  state.documents[path] = { version: 1, items: [{ ...initial[0], text: 'Whole milk' }, initial[1]] }; state.revisions[path] = 2;
  await refreshPlanners(page);
  await expect(page.getByRole('group', { name: 'Resolve Whole milk' })).toBeVisible();
  await expect(labels(page)).toHaveText(['Bread']);
  await page.getByRole('button', { name: 'Use family change', exact: true }).click();
  await expect(labels(page)).toHaveText(['Whole milk', 'Bread']);
  await toggleCurrentPanel(page);
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(() => state.revisions[path]).toBe(2);
});

test('durable pending changes survive reload and retry without duplicates', async ({ page, context }) => {
  const state = await fixture(context); await open(page, true); state.failSave = true;
  await quick(page, 'Milk').click();
  await refreshPlanners(page);
  await expect(panel(page).getByRole('alert')).toContainText('did not save');
  expect(await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(tick(page, 'Milk')).toBeVisible();
  state.failSave = false;
  await refreshPlanners(page);
  await expect.poll(() => state.revisions[path]).toBe(2);
  await expect.poll(() => (state.documents[path] as { items: ShoppingItem[] } | undefined)?.items).toHaveLength(1);
});

for (const status of [401, 403]) test(`expired shopping access (${status}) can be replaced without losing the pending batch`, async ({ page, context }) => {
  const state = await fixture(context);
  await open(page, true);
  await quick(page, 'Milk').click();
  await context.route('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals**', route => {
    if (route.request().headers().authorization === 'Bearer replacement-test-token') return route.fallback();
    return route.fulfill({ status, json: {} });
  });
  await page.getByRole('contentinfo').getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByText('Your saved token is no longer working.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disconnect GitHub', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Update app', exact: true })).toBeEnabled();
  await page.getByLabel('GitHub token').fill('replacement-test-token');
  await page.getByRole('button', { name: 'Save new token', exact: true }).click();
  await expect(page.getByText('GitHub connected', { exact: true })).toBeVisible();
  await page.getByRole('contentinfo').getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(tick(page, 'Milk')).toBeVisible();
  await expect.poll(() => (state.documents[path] as { items: ShoppingItem[] } | undefined)?.items).toHaveLength(1);
  expect((state.documents[path] as { items: ShoppingItem[] }).items[0]!.text).toBe('Milk');
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/'))).toBe('replacement-test-token');
});

test('shared refresh updates meals and shopping together, preserves drafts and leaves unchanged rows in place', async ({ page, context }) => {
  const state = await fixture(context);
  const mealPath = 'weeks/2026-10-19.json';
  state.documents[mealPath] = { version: 2, meals: { '2026-10-19/breakfast': 'Toast' } };
  state.documents['defaults.json'] = { version: 1, meals: {} };
  state.documents[path] = { version: 1, items: initial };
  await open(page, true);
  const footer = page.getByRole('contentinfo');

  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByLabel('Shopping item', { exact: true }).fill('Keep shopping draft');
  await footer.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await page.getByRole('button', { name: /^Monday 19 Oct, Breakfast:/ }).click();
  await page.locator('#meal-text').fill('Keep meal draft');
  state.documents[mealPath] = { version: 2, meals: { '2026-10-19/breakfast': 'Porridge' } };
  state.documents[path] = { version: 1, items: [...initial, { id: 'eggs', text: 'Eggs', checked: false }] };
  const before = state.reads.length;
  await refreshPlanners(page);
  await expect(page.getByRole('button', { name: /^Monday 19 Oct, Breakfast:/ })).toContainText('Porridge');
  await expect(page.locator('.shopping-item-name')).toHaveText(['Milk', 'Bread', 'Eggs']);
  expect(state.reads.slice(before)).toEqual(expect.arrayContaining([mealPath, 'defaults.json', path, cataloguePath]));
  await expect(page.locator('#meal-text')).toHaveValue('Keep meal draft');
  await footer.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await expect(page.getByLabel('Shopping item', { exact: true })).toHaveValue('Keep shopping draft');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const row = await labels(page).first().elementHandle();
  if (!await page.locator('.refresh-button').isVisible()) await panel(page).evaluate(el => { el.scrollTop = 0; });
  const scroll = await panel(page).evaluate(el => el.scrollTop);
  const sameReads = state.reads.length;
  await refreshPlanners(page);
  await expect.poll(() => state.reads.length).toBeGreaterThanOrEqual(sameReads + 4);
  expect(await row!.evaluate(el => el === document.querySelector('.shopping-item-name'))).toBe(true);
  expect(await panel(page).evaluate(el => el.scrollTop)).toBe(scroll);
  expect(state.revisions[path]).toBeUndefined();
  await footer.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.locator('#meal-text')).toHaveValue('Keep meal draft');
});

async function pullTouch(page: Page, type: string, dx = 0, dy = 0, fingers = 1) {
  await page.locator('.planner-heading').evaluate((el, { type, dx, dy, fingers }) => {
    const rect = el.getBoundingClientRect();
    const touch = { identifier: 1, clientX: rect.x + 20 + dx, clientY: rect.y + 10 + dy };
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : Array.from({ length: fingers }, (_, index) => ({ ...touch, identifier: index + 1 })) });
    el.dispatchEvent(event);
  }, { type, dx, dy, fingers });
}

test('Refresh stays visible on phones, tablets and desktops without overflowing the footer', async ({ page, context }) => {
  await fixture(context); await open(page);
  const footer = page.getByRole('contentinfo');
  for (const width of [320, 390, 768, 1023, 1024, 1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.refresh-button')).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(1);
    const buttons = 7 + Number(width >= 768);
    await expect(footer.locator('button:visible')).toHaveCount(buttons);
    const columns = await footer.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width <= 431 ? 5 : buttons);
    await expect(footer.locator('.saving-indicator')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('Refresh checks all planner files from captions and Settings as well as both planners', async ({ page, context }) => {
  const state = await fixture(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto('/');
  for (const screen of ['Speech to text', 'Settings', 'Meal planner', 'Shopping list']) {
    await page.getByRole('button', { name: screen, exact: true }).click();
    const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
    await expect(refresh).toBeVisible();
    await expect(refresh).toBeEnabled();
    state.reads = [];
    await refresh.click();
    await expect.poll(() => state.reads).toEqual(expect.arrayContaining([
      'weeks/2026-10-19.json', 'defaults.json', path, cataloguePath,
    ]));
  }
});

for (const screen of ['Shopping list', 'Meal planner']) test(`pull-to-refresh in ${screen} syncs both planners and preserves editor text`, async ({ page, context }) => {
  const state = await fixture(context);
  const mealPath = 'weeks/2026-10-19.json';
  state.documents[mealPath] = { version: 2, meals: { '2026-10-19/breakfast': 'Toast' } };
  state.documents['defaults.json'] = { version: 1, meals: {} };
  state.documents[path] = { version: 1, items: initial };
  await open(page, true);
  if (screen === 'Meal planner') {
    await enableSplit(page);
    await page.getByRole('button', { name: screen, exact: true }).click();
    await page.getByRole('button', { name: /^Monday 19 Oct, Breakfast:/ }).click();
    await page.locator('#meal-text').fill('My breakfast');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: /^Monday 19 Oct, Lunch:/ }).click();
    await page.locator('#meal-text').fill('Keep meal draft');
  } else {
    await page.setViewportSize({ width: 390, height: 844 });
    await tick(page, 'Milk').check();
    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await page.getByLabel('Shopping item', { exact: true }).fill('Keep shopping draft');
  }
  state.documents[path] = { version: 1, items: [{ ...initial[0], text: 'Family milk' }, initial[1]] };
  state.documents[mealPath] = { version: 2, meals: { '2026-10-19/breakfast': 'Toast', '2026-10-19/dinner': 'Family dinner' } };
  await page.locator('.planner-panel').evaluate(el => { el.scrollTop = 0; });
  const before = state.reads.length;
  await pullTouch(page, 'touchstart');
  await pullTouch(page, 'touchmove', 0, 30);
  await expect(page.getByText('Pull down to sync and refresh', { exact: true })).toBeVisible();
  await pullTouch(page, 'touchmove', 0, 90);
  await expect(page.getByText('Release to sync and refresh', { exact: true })).toBeVisible();
  await pullTouch(page, 'touchend');
  await expect.poll(() => state.reads.slice(before)).toEqual(expect.arrayContaining([mealPath, 'defaults.json', path, cataloguePath]));
  await expect(page.locator('.pull-refresh-status')).toHaveCount(0);
  await expect(labels(page)).toHaveText(['Family milk', 'Bread']);
  if (screen === 'Meal planner') {
    await expect.poll(() => state.documents[mealPath]).toEqual({ version: 2, meals: { '2026-10-19/breakfast': 'My breakfast', '2026-10-19/dinner': 'Family dinner' } });
    await expect(page.locator('#meal-text')).toHaveValue('Keep meal draft');
    await expect(page.getByRole('region', { name: 'Live transcript' })).toBeVisible();
  } else {
    await expect.poll(() => (state.documents[path] as { items: ShoppingItem[] }).items[0]).toEqual({ ...initial[0], text: 'Family milk', checked: true });
    await expect(page.getByLabel('Shopping item', { exact: true })).toHaveValue('Keep shopping draft');
  }
});

test('short, horizontal, cancelled, reversed and multi-touch pulls do not refresh; scrolling must start at the top', async ({ page, context }) => {
  const state = await fixture(context);
  state.documents[path] = { version: 1, items: Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}`, text: `Item ${index}`, checked: false })) };
  await open(page);
  const before = state.reads.length;
  for (const gesture of ['short', 'horizontal', 'cancel', 'reverse', 'multiple', 'scrolled']) {
    await page.locator('.planner-panel').evaluate((el, scrolled) => { el.scrollTop = scrolled ? 100 : 0; }, gesture === 'scrolled');
    if (gesture === 'scrolled') expect(await page.locator('.planner-panel').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await pullTouch(page, 'touchstart');
    await pullTouch(page, 'touchmove', gesture === 'horizontal' ? 150 : 0, gesture === 'short' ? 30 : 90);
    if (gesture === 'reverse') await pullTouch(page, 'touchmove', 0, 0);
    if (gesture === 'multiple') await pullTouch(page, 'touchstart', 0, 90, 2);
    await pullTouch(page, gesture === 'cancel' ? 'touchcancel' : 'touchend');
    await expect(page.locator('.pull-refresh-status')).toHaveCount(0);
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(state.reads).toHaveLength(before);
});

test('native touch pull at the header refreshes without reloading', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native touch input uses Chromium CDP; physical Safari remains a manual check.');
  const state = await fixture(context); state.documents[path] = { version: 1, items: initial };
  await open(page); await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const header = (await page.locator('.planner-heading').boundingBox())!;
  const point = { x: header.x + 30, y: header.y + 10, id: 1 };
  state.documents[path] = { version: 1, items: [...initial, { id: 'eggs', text: 'Eggs', checked: false }] };
  await page.evaluate(() => Object.assign(window, { pullTestMarker: true }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  for (const distance of [15, 35, 60, 95]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + distance }] });
  await expect(page.getByText('Release to sync and refresh', { exact: true })).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(labels(page)).toHaveText(['Milk', 'Bread', 'Eggs']);
  expect(await page.evaluate(() => (window as Window & { pullTestMarker?: boolean }).pullTestMarker)).toBe(true);
});
