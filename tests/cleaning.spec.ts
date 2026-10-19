import { expect, test, type BrowserContext, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
type Document = { version: number; tasks?: Record<string, string | null>; completed?: Record<string, boolean>; meals?: Record<string, string> };
const week = '2026-10-19';
const weeklyFile = `cleaning/weeks/${week}.json`;
const defaultsFile = 'cleaning/defaults.json';
const day = 'Monday 19 Oct';

async function fixture(context: BrowserContext) {
  const state = { documents: { [`weeks/${week}.json`]: { version: 1, meals: { [`${week}/breakfast`]: 'Toast' } } } as Record<string, Document>,
    revisions: {} as Record<string, number>, failSave: false, failRead: false, holdSave: undefined as Promise<void> | undefined, reads: [] as string[] };
  const path = (url: string) => new URL(url).pathname.split(url.includes('api.github.com') ? '/contents/' : '/main/')[1]!;
  await context.route('https://raw.githubusercontent.com/H-Wilderspin/speech-to-text-meals/**', route => {
    const file = path(route.request().url()); state.reads.push(file);
    if (state.failRead) return route.fulfill({ status: 503, json: {} });
    return route.fulfill({ status: state.documents[file] ? 200 : 404, json: state.documents[file] ?? {} });
  });
  await context.route('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals**', async route => {
    const req = route.request();
    if (!req.url().includes('/contents/')) return route.fulfill({ json: { permissions: { push: true } } });
    const file = path(req.url());
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

async function open(page: Page, connected = false, base = '/') {
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(base);
  if (connected) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('GitHub token').fill('test-only-token');
    await page.getByLabel('Remember on this device').check();
    await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
    await expect(page.getByText('GitHub connected', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to captions' }).click();
  }
  await page.getByRole('button', { name: 'Task planner', exact: true }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Task plan updated');
}
const panel = (page: Page) => page.getByRole('dialog', { name: 'Task planner' });
const editor = (page: Page) => page.getByRole('form', { name: 'Edit task' });
const tick = (page: Page, text: string, date = day) => page.getByRole('checkbox', { name: `Complete ${text} on ${date}`, exact: true });
const editTask = (page: Page, text: string, date = day) => page.getByRole('button', { name: `Edit ${text} on ${date}`, exact: true }).click();
async function add(page: Page, text: string, recurring = false) {
  await page.getByRole('button', { name: `Add task for ${day}`, exact: true }).click();
  await page.getByLabel('Task', { exact: true }).fill(text);
  if (recurring) await editor(page).getByLabel('Apply to').selectOption('default');
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(tick(page, text)).toBeVisible();
}

test('tasks are readable anonymously, supports both splits and replaces the meal pane', async ({ page, context }) => {
  const state = await fixture(context);
  state.documents[defaultsFile] = { version: 1, tasks: { 'monday/vacuum': 'Vacuum' }, completed: {} };
  await open(page, false, 'http://127.0.0.1:4174/speech-to-text/');
  await expect(tick(page, 'Vacuum')).toBeDisabled();
  await expect(panel(page).getByRole('button', { name: /Add task for/ })).toHaveCount(7);
  expect(state.reads.every(path => path.startsWith('cleaning/'))).toBe(true);
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Vertical split (side by side)', 'Horizontal split (stacked)']) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.getByRole('region', { name: 'Live transcript' })).toBeVisible();
      expect(await panel(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path: `test-results/cleaning-${width}-${name.startsWith('Vertical') ? 'vertical' : 'horizontal'}-${test.info().project.name}.png` });
    }
  }
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Monday 19 Oct, Breakfast:/ })).toContainText('Toast');
  await page.getByRole('button', { name: 'Task planner', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(tick(page, 'Vacuum')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Horizontal split (stacked)', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('weekly tasks, dated overrides, skips, completions and removals are shared independently', async ({ page, context }) => {
  const state = await fixture(context); await open(page, true);
  await add(page, 'Vacuum', true); await add(page, 'Shopping trip');
  await tick(page, 'Vacuum').click();
  await expect(tick(page, 'Vacuum')).toBeChecked();
  const other = await context.newPage(); await open(other);
  await expect(tick(other, 'Vacuum')).toBeChecked();
  await other.close();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(tick(page, 'Vacuum', 'Monday 26 Oct')).not.toBeChecked();
  await expect(page.getByText('Shopping trip', { exact: true })).toHaveCount(0);
  await editTask(page, 'Vacuum', 'Monday 26 Oct');
  await page.getByLabel('Task', { exact: true }).fill('Vacuum upstairs');
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Previous week', exact: true }).click();
  await editTask(page, 'Vacuum');
  await editor(page).getByRole('button', { name: 'Skip this task', exact: true }).click();
  await expect(tick(page, 'Vacuum')).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore task', exact: true }).click();
  await expect(tick(page, 'Vacuum')).toBeChecked();
  await editTask(page, 'Vacuum');
  await editor(page).getByLabel('Apply to').selectOption('default');
  await page.getByLabel('Task', { exact: true }).fill('Vacuum downstairs');
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(tick(page, 'Vacuum downstairs')).toBeChecked();
  await editTask(page, 'Vacuum downstairs');
  await editor(page).getByLabel('Apply to').selectOption('default');
  await editor(page).getByRole('button', { name: 'Remove weekly task', exact: true }).click();
  await expect(tick(page, 'Vacuum downstairs')).toHaveCount(0);
  await editTask(page, 'Shopping trip');
  await editor(page).getByRole('button', { name: 'Remove task', exact: true }).click();
  await expect(tick(page, 'Shopping trip')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(tick(page, 'Vacuum upstairs', 'Monday 26 Oct')).toBeVisible();
  expect(state.documents[`weeks/${week}.json`]).toEqual({ version: 1, meals: { [`${week}/breakfast`]: 'Toast' } });
});

test('refresh keeps drafts, detects concurrent changes and failed saves retain text', async ({ page, context }) => {
  const state = await fixture(context); await page.clock.install({ time: new Date('2026-10-19T12:00:00') });
  state.documents[defaultsFile] = { version: 1, tasks: { 'monday/vacuum': 'Vacuum' }, completed: {} };
  await open(page, true);
  state.failSave = true;
  await tick(page, 'Vacuum').click();
  await expect(panel(page).getByRole('alert')).toContainText('did not save');
  await expect(tick(page, 'Vacuum')).not.toBeChecked();
  state.failSave = false;
  await editTask(page, 'Vacuum');
  await editor(page).getByLabel('Apply to').selectOption('default');
  await page.getByLabel('Task', { exact: true }).fill('My draft');
  state.documents[defaultsFile]!.tasks!['monday/vacuum'] = 'Other edit';
  state.revisions[defaultsFile] = 2;
  await page.clock.fastForward(60000);
  await expect(tick(page, 'Other edit')).toBeAttached();
  await expect(page.getByLabel('Task', { exact: true })).toHaveValue('My draft');
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor(page).getByRole('alert')).toContainText('Someone changed');
  expect(state.documents[defaultsFile]!.tasks!['monday/vacuum']).toBe('Other edit');
  await editor(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await editTask(page, 'Other edit');
  await page.getByLabel('Task', { exact: true }).fill('Keep after failure'); state.failSave = true;
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor(page).getByRole('alert')).toContainText('did not save');
  await expect(page.getByLabel('Task', { exact: true })).toHaveValue('Keep after failure');
  await editor(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  state.failSave = false; state.failRead = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(panel(page).getByRole('alert')).toBeVisible();
  await expect(tick(page, 'Other edit')).toBeVisible();
  state.failRead = false;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(panel(page).getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Horizontal split (stacked)', exact: true }).click();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  const cleaningReads = state.reads.filter(path => path.startsWith('cleaning/')).length;
  await page.clock.fastForward(60000);
  expect(state.reads.filter(path => path.startsWith('cleaning/')).length).toBe(cleaningReads);
});

test('planner switching preserves both drafts and captions, and saves block pane switching', async ({ page, context }) => {
  const state = await fixture(context);
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void; onend?: () => void; onresult?: (event: unknown) => void;
      start() { Object.assign(window, { testRecognition: this }); this.onstart?.(); }
      stop() { this.onend?.(); } abort() { queueMicrotask(() => this.onend?.()); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await open(page, true);
  await page.getByRole('button', { name: 'Horizontal split (stacked)', exact: true }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await page.getByRole('button', { name: `Add task for ${day}`, exact: true }).click();
  await page.getByLabel('Task', { exact: true }).fill('Clean kitchen');
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await page.getByRole('button', { name: /^Monday 19 Oct, Breakfast:/ }).click();
  await page.locator('#meal-text').fill('Meal draft');
  await page.getByRole('button', { name: 'Task planner', exact: true }).click();
  await expect(page.getByLabel('Task', { exact: true })).toHaveValue('Clean kitchen');
  await expect(page.locator('#meal-text')).toBeHidden();
  await page.evaluate(() => {
    (window as Window & { testRecognition?: { onresult: (event: unknown) => void } }).testRecognition?.onresult({ results: [{ 0: { transcript: 'Let us clean the kitchen.', confidence: .9 }, length: 1, isFinal: true }] });
  });
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('Let us clean the kitchen.');
  let release!: () => void;
  state.holdSave = new Promise<void>(resolve => { release = resolve; });
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  try {
    await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Task planner', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Horizontal split (stacked)', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
  } finally { release(); }
  await expect(tick(page, 'Clean kitchen')).toBeVisible();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(tick(page, 'Clean kitchen')).toBeVisible();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.locator('#meal-text')).toHaveValue('Meal draft');
  await page.getByRole('button', { name: 'Task planner', exact: true }).click();
  await page.getByRole('button', { name: 'Back to captions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Task planner', exact: true })).toBeFocused();
  await page.reload();
  await page.getByRole('button', { name: 'Task planner', exact: true }).click();
  await expect(tick(page, 'Clean kitchen')).toBeEnabled();
  expect(state.documents[weeklyFile]?.tasks).toBeDefined();
});
