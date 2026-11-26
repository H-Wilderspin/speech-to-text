import { refreshPlanners, toggleCurrentPanel } from './navigation';
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

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
  await expect(page.locator('.app-panel:visible').getByRole('status')).toHaveText('Plan updated');
}
async function settings(page: Page) {
  await toggleCurrentPanel(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
}
async function planner(page: Page) {
  await toggleCurrentPanel(page);
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
}
async function connect(page: Page) {
  await settings(page);
  await page.getByLabel('GitHub token').fill('test-only-token');
  await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
  await expect(page.getByText('GitHub connected', { exact: true })).toBeVisible();
  await planner(page);
}
const breakfast = (page: Page) => page.getByRole('button', { name: /^Monday 19 Oct, Breakfast:/ });
const split = (page: Page) => page.getByRole('button', { name: 'Split view', exact: true });

test('meal Save and Cancel remain reachable when the keyboard reduces phone height', async ({ page, context }) => {
  const state = await fixture(context);
  state.meals[key] = 'Toast';
  state.defaults['monday/breakfast'] = 'Cereal';
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await connect(page);
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Eggs');
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /interactive-widget=resizes-content/);
  // Models Chrome's resized layout viewport, not a physical Android keyboard.
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 400 });
    for (const name of ['Save', 'Cancel']) {
      const button = page.getByRole('button', { name, exact: true });
      await expect.poll(() => button.evaluate(element => {
        const box = element.getBoundingClientRect();
        const header = document.querySelector('.meal-header')!.getBoundingClientRect();
        const footer = document.querySelector('.toolbar')!.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return { belowHeader: box.top >= header.bottom, aboveFooter: box.bottom <= footer.top,
          touchTarget: box.height >= 48, reachable: element.contains(hit), top: box.top, bottom: box.bottom,
          headerBottom: header.bottom, footerTop: footer.top };
      })).toMatchObject({ belowHeader: true, aboveFooter: true, touchTarget: true, reachable: true });
    }
  }
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Edit meal' })).toHaveCount(0);
  expect(state.meals[key]).toBe('Toast');
  await page.setViewportSize({ width: 390, height: 844 });
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Eggs');
  await page.setViewportSize({ width: 390, height: 400 });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast(page)).toContainText('Eggs');
  await expect(page.getByRole('form', { name: 'Edit meal' })).toHaveCount(0);
});

test('meal actions follow visual-only keyboard resizing and panning across repeated edits', async ({ page, context }) => {
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  });
  const state = await fixture(context);
  state.meals[key] = 'Toast';
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await connect(page);
  for (const offset of [0, 35, 0]) {
    await breakfast(page).click();
    await page.locator('#meal-text').fill('Eggs');
    await page.evaluate(offsetTop => {
      Object.assign(window.visualViewport!, { height: 400, offsetTop });
      window.visualViewport!.dispatchEvent(new Event(offsetTop ? 'scroll' : 'resize'));
    }, offset);
    for (const name of ['Save', 'Cancel']) {
      await expect.poll(() => page.getByRole('button', { name, exact: true }).evaluate(element => {
        const box = element.getBoundingClientRect();
        const viewport = window.visualViewport!;
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return box.top >= viewport.offsetTop && box.bottom <= viewport.offsetTop + viewport.height && element.contains(hit);
      })).toBe(true);
    }
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.evaluate(() => {
      Object.assign(window.visualViewport!, { height: 844, offsetTop: 0 });
      window.visualViewport!.dispatchEvent(new Event('resize'));
    });
    await expect.poll(() => page.locator('.app-shell').evaluate(element => Math.round(element.getBoundingClientRect().height))).toBe(844);
  }
  expect(state.meals[key]).toBe('Toast');
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 200, offsetTop: 70, scale: 2 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await expect.poll(() => page.locator('.app-shell').evaluate(element => Math.round(element.getBoundingClientRect().height))).toBe(844);
});

for (const kind of ['blank', 'default', 'dated'] as const) {
  test(`Monday lunch keeps its actions visible when keyboard opening coincides with focus (${kind})`, async ({ page, context }) => {
    await page.addInitScript(() => {
      const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
      document.addEventListener('focusin', event => {
        if ((event.target as HTMLElement).id !== 'meal-text') return;
        Object.assign(viewport, { height: 400, offsetTop: 35 });
        viewport.dispatchEvent(new Event('resize'));
        viewport.dispatchEvent(new Event('scroll'));
      });
    });
    const state = await fixture(context);
    if (kind === 'default') state.defaults['monday/lunch'] = 'Vegetables and potatoes with a selection of salads. '.repeat(5);
    if (kind === 'dated') state.meals[`${week}/lunch`] = 'Soup';
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await connect(page);
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.locator('.planner-panel').evaluate(element => { element.scrollTop = 0; });
      await page.getByRole('button', { name: /^Monday 19 Oct, Lunch:/ }).click();
      await expect(page.locator('#meal-text')).toBeFocused();
      for (const name of ['Save', 'Cancel']) {
        await expect.poll(() => page.getByRole('button', { name, exact: true }).evaluate(element => {
          const box = element.getBoundingClientRect();
          const header = document.querySelector('.meal-header')!.getBoundingClientRect();
          const footer = document.querySelector('.toolbar')!.getBoundingClientRect();
          const viewport = window.visualViewport!;
          return box.top >= header.bottom && box.bottom <= Math.min(footer.top, viewport.offsetTop + viewport.height)
            && element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        })).toBe(true);
      }
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.evaluate(() => {
        Object.assign(window.visualViewport!, { height: 844, offsetTop: 0 });
        window.visualViewport!.dispatchEvent(new Event('resize'));
      });
      await expect.poll(() => page.locator('.app-shell').evaluate(element => Math.round(element.getBoundingClientRect().height))).toBe(844);
    }
    expect(state.saves).toBe(0);
  });
}

test('meal headings stay below the header while scrolling and default tags sit at card bottoms', async ({ page, context }) => {
  const state = await fixture(context);
  state.defaults['monday/breakfast'] = 'Toast';
  state.defaults['monday/lunch'] = 'Vegetables and potatoes with a selection of salads. '.repeat(5);
  await page.setViewportSize({ width: 1280, height: 600 });
  await open(page);
  const panel = page.locator('.planner-panel');
  const header = page.locator('.meal-header');
  const headings = page.locator('.meal-grid-head');
  const card = breakfast(page);
  const bounds = await card.evaluate(el => {
    const box = el.getBoundingClientRect();
    const text = el.querySelector('.meal-slot-text')!.getBoundingClientRect();
    const tag = el.querySelector('.meal-default-marker')!.getBoundingClientRect();
    return { topGap: text.top - box.top, bottomGap: box.bottom - tag.bottom,
      leftGap: tag.left - box.left, rightGap: box.right - tag.right, between: tag.top - text.bottom };
  });
  expect(bounds.topGap).toBeLessThan(16);
  expect(bounds.bottomGap).toBeCloseTo(1, 0);
  expect(bounds.leftGap).toBeCloseTo(1, 0);
  expect(bounds.rightGap).toBeCloseTo(1, 0);
  expect(bounds.between).toBeGreaterThan(100);
  const expectStickyHeadings = async () => {
    await panel.evaluate(el => { el.scrollTop = 300; });
    await expect.poll(async () => Math.abs((await headings.boundingBox())!.y -
      ((await header.boundingBox())!.y + (await header.boundingBox())!.height))).toBeLessThan(2);
  };
  await expectStickyHeadings();
  await page.setViewportSize({ width: 1024, height: 600 });
  await split(page).click();
  await expectStickyHeadings();
  // Enlarged text changes the title/date height; the column labels must follow it.
  await panel.evaluate(el => { (el as HTMLElement).style.setProperty('--text-small', '24px'); });
  await expectStickyHeadings();
  await panel.evaluate(el => { (el as HTMLElement).style.removeProperty('--text-small'); });
  await page.setViewportSize({ width: 390, height: 600 });
  await expect(headings).toBeHidden();
  // Let WebKit finish the resize/layout and scroll anchoring before positioning
  // the card. Hidden column headings alone do not mean that scroll has settled.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const lunch = page.getByRole('button', { name: /^Monday 19 Oct, Lunch:/ });
  await lunch.evaluate(el => {
    const container = el.closest('.planner-panel')!;
    container.scrollTop += el.getBoundingClientRect().top - container.querySelector('.meal-header')!.getBoundingClientRect().bottom + 50;
  });
  await expect.poll(async () => Math.abs((await lunch.locator('.meal-slot-label').boundingBox())!.y -
    ((await header.boundingBox())!.y + (await header.boundingBox())!.height))).toBeLessThan(2);
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
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
  const planner = page.locator('#planner-panel');
  const returnToThisWeek = page.getByRole('button', { name: 'Go to this week', exact: true });
  for (const scrollTop of [0, 300, 10000]) {
    await planner.evaluate((el, top) => { el.scrollTop = top; }, scrollTop);
    await expect.poll(async () => {
      const button = (await returnToThisWeek.boundingBox())!;
      const section = (await planner.boundingBox())!;
      return Math.abs(section.y + section.height - button.y - button.height);
    }).toBeLessThan(20);
  }
  await page.getByRole('button', { name: 'Go to this week', exact: true }).click();
  await expect(page.locator('.meal-day .today-marker')).toHaveText('Today');
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.locator('.app-panel:visible').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await toggleCurrentPanel(page);
  await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toBeFocused();
});

test('create, edit, share across pages, delete; connections are remembered automatically', async ({ page, context }) => {
  const state = await fixture(context);
  await open(page); await connect(page);
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Œufs & café');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast(page)).toContainText('Œufs & café');
  await expect(breakfast(page)).toBeFocused();
  await expect.poll(() => state.meals[key]).toBe('Œufs & café');
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Toast');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast(page)).toContainText('Toast');
  const reader = await context.newPage();
  await open(reader);
  await expect(breakfast(reader)).toContainText('Toast');
  await expect(breakfast(reader)).toBeEnabled();
  await reader.close();
  await breakfast(page).click();
  await page.getByRole('button', { name: 'Remove meal', exact: true }).click();
  await expect(breakfast(page)).toContainText('Add meal');
  await expect.poll(() => state.meals[key]).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/'))).toBe('test-only-token');
  await toggleCurrentPanel(page);
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
  await expect(breakfast(page)).toBeEnabled();
});

test('failed saves retain local meals; conflicts require a choice without overwriting', async ({ page, context }) => {
  const state = await fixture(context);
  await open(page); await connect(page); await breakfast(page).click();
  await page.locator('#meal-text').fill('Porridge');
  state.failSave = true;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await refreshPlanners(page);
  await expect(breakfast(page)).toContainText('Porridge');
  await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toBeEnabled();
  state.failSave = false; state.meals[key] = 'Toast'; state.revision++;
  await refreshPlanners(page);
  const conflict = page.getByRole('group', { name: 'Resolve Monday 19 Oct Breakfast', exact: true });
  await expect(conflict).toContainText('Family: Toast');
  expect(state.meals[key]).toBe('Toast');
  await conflict.getByRole('button', { name: 'Use family change', exact: true }).click();
  await expect(breakfast(page)).toContainText('Toast');
});

test('opening meals preserves listening and caption Clear does not clear meals', async ({ page, context }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
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
  await split(page).click();
  await expect(page.getByRole('region', { name: 'Meal planner' })).not.toHaveAttribute('aria-modal');
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('A caption.');
  await page.evaluate(() => {
    (window as Window & { testRecognition?: { onresult: (event: unknown) => void } }).testRecognition?.onresult({ resultIndex: 1, results: [
      { 0: { transcript: 'A caption.', confidence: .9 }, length: 1, isFinal: true },
      { 0: { transcript: 'Let us discuss toast.', confidence: .9 }, length: 1, isFinal: false },
    ] });
  });
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('Let us discuss toast.');
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.locator('.app-panel:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('Let us discuss toast.');
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(split(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('Tap Listen to start.');
  await expect(breakfast(page)).toContainText('Toast');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  await toggleCurrentPanel(page);
  await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(page)).toContainText('Toast');
  await expect(split(page)).toHaveAttribute('aria-pressed', 'true');
});

test('one split toggle keeps captions left on tablet-sized screens and disappears on phones', async ({ page, context }) => {
  await fixture(context); await open(page);
  for (const width of [1280, 768, 767, 320, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const dialog = page.getByRole('region', { name: 'Meal planner' });
    const header = page.locator('.meal-header');
    await expect(header.getByRole('button')).toHaveCount(2);
    await expect(header.getByRole('button', { name: 'Previous week' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Next week' })).toBeVisible();
    await expect(header.getByRole('button', { name: /Refresh|Split view/ })).toHaveCount(0);
    const heading = (await header.boundingBox())!;
    const date = (await page.locator('.week-heading').boundingBox())!;
    const title = (await header.getByRole('heading', { name: 'Meal planner', exact: true }).boundingBox())!;
    await expect(header.locator('.week-heading')).toBeVisible();
    expect(date.y).toBeGreaterThanOrEqual(title.y + title.height);
    expect(date.y + date.height).toBeLessThanOrEqual(heading.y + heading.height);
    expect(Math.abs(date.x + date.width / 2 - title.x - title.width / 2)).toBeLessThan(1);
    await expect(page.locator('.refresh-button')).toBeVisible();
    await expect(page.getByRole('button', { name: /Horizontal split|Vertical split/ })).toHaveCount(0);
    if (width < 768) {
      await expect(split(page)).toHaveCount(0);
      await expect(dialog).not.toHaveAttribute('aria-modal');
      await expect(page.locator('.content-layout')).not.toHaveClass(/with-meals/);
      await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Live transcript' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('contentinfo').getByRole('button', { name: 'Split view' })).toBeVisible();
      if (await split(page).getAttribute('aria-pressed') !== 'true') await split(page).click();
      await expect(split(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog).not.toHaveAttribute('aria-modal');
      const captions = (await page.getByRole('region', { name: 'Live transcript' }).boundingBox())!;
      const captionPane = (await page.locator('#captions').boundingBox())!;
      const meals = (await dialog.boundingBox())!;
      const toolbar = (await page.getByRole('contentinfo').boundingBox())!;
      expect(captions.height).toBeGreaterThan(100);
      expect(captions.x + captions.width).toBeLessThanOrEqual(meals.x);
      expect(Math.abs(captionPane.y - meals.y)).toBeLessThan(1);
      expect(meals.y + meals.height).toBeLessThanOrEqual(toolbar.y + 1);
      await expect(page.getByRole('button', { name: /Back to captions|Close planner/ })).toHaveCount(0);
      const toggle = (await split(page).boundingBox())!;
      expect(toggle.width).toBeGreaterThanOrEqual(48);
      expect(toggle.height).toBeGreaterThanOrEqual(48);
      const settings = (await page.getByRole('contentinfo').getByRole('button', { name: 'Settings', exact: true }).boundingBox())!;
      expect(toggle.y).toBe(settings.y);
      expect(settings.x - toggle.x - toggle.width).toBeLessThanOrEqual(9);
      expect(toggle.x + toggle.width).toBeLessThanOrEqual(settings.x);
    }
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page.locator('.week-heading')).toHaveText('26 Oct - 1 Nov, 2026');
    await page.getByRole('button', { name: 'Previous week' }).click();
    await page.screenshot({ path: `test-results/split-toggle-${width}-${test.info().project.name}.png` });
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await toggleCurrentPanel(page);
  await expect(page.locator('.app-panel:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(split(page)).toHaveAttribute('aria-pressed', 'true');
  await split(page).click();
  await expect(split(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('region', { name: 'Meal planner' })).not.toHaveAttribute('aria-modal');
  await toggleCurrentPanel(page);
  await expect(page.locator('.app-panel:visible')).toHaveCount(0);
});

test('split toggle and phone fallback preserve the selected week, draft and preference', async ({ page, context }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await fixture(context); await open(page); await connect(page);
  await page.getByRole('button', { name: 'Next week' }).click();
  await page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ }).click();
  await page.locator('#meal-text').fill('Porridge and berries');
  await page.getByLabel('Apply to').selectOption('default');
  for (const enabled of [true, false, true]) {
    await split(page).click();
    await expect(split(page)).toHaveAttribute('aria-pressed', String(enabled));
    await expect(page.locator('.week-heading')).toHaveText('26 Oct - 1 Nov, 2026');
    await expect(page.locator('#meal-text')).toHaveValue('Porridge and berries');
    await expect(page.getByLabel('Apply to')).toHaveValue('default');
    await expect(split(page)).toBeFocused();
  }
  await page.setViewportSize({ width: 767, height: 900 });
  await expect(split(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Meal planner' })).not.toHaveAttribute('aria-modal');
  await expect(page.locator('.content-layout')).not.toHaveClass(/with-meals/);
  await expect(page.locator('#meal-text')).toHaveValue('Porridge and berries');
  await expect(page.locator('.week-heading')).toHaveText('26 Oct - 1 Nov, 2026');
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(split(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.content-layout')).toHaveClass(/with-meals/);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ })).toContainText('Porridge and berries');
  await expect(page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ })).toBeFocused();
  await split(page).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(split(page)).toHaveAttribute('aria-pressed', 'false');
  await toggleCurrentPanel(page);
  await expect(page.locator('.app-panel:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Meal planner', exact: true })).toBeFocused();
});

test('This week follows the current date when the planner stays open across Monday', async ({ page, context }) => {
  await fixture(context);
  await page.clock.install({ time: new Date('2026-10-25T23:59:30') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.locator('.app-panel:visible').getByRole('status')).toHaveText('Plan updated');
  await page.clock.fastForward(60000);
  await page.getByRole('button', { name: 'Go to this week', exact: true }).click();
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
  await expect(page.locator('.app-panel:visible').getByRole('alert')).toContainText('Check your connection');
  await expect(page.getByText('Loading plan…', { exact: true })).toHaveCount(0);
  offline = false;
  await refreshPlanners(page);
  await expect(breakfast(page)).toContainText('Toast');
  await expect(page.locator('.app-panel:visible').getByRole('alert')).toHaveCount(0);
  offline = true;
  await refreshPlanners(page);
  await expect(page.locator('.app-panel:visible').getByRole('alert')).toContainText('Check your connection');
  await expect(breakfast(page)).toContainText('Toast');
});

test('automatic refresh preserves a draft and detects a newer edit before saving', async ({ page, context }) => {
  const state = await fixture(context);
  await page.clock.install({ time: new Date('2026-10-19T12:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.locator('.app-panel:visible').getByRole('status')).toHaveText('Plan updated');
  await connect(page);
  await breakfast(page).click();
  await page.locator('#meal-text').fill('My breakfast');
  state.meals[key] = 'Family breakfast'; state.revision++;
  await page.clock.fastForward(60000);
  await expect(breakfast(page)).toContainText('Family breakfast');
  await expect(page.locator('#meal-text')).toHaveValue('My breakfast');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Resolve Monday 19 Oct Breakfast', exact: true })).toContainText('Family: Family breakfast');
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
  await connect(page);
  await settings(page);
  await expect(page.getByRole('region', { name: 'Planner editing' }).getByText('Remembered on this device.', { exact: false })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), savedKey)).toBe('test-only-token');
  await page.reload();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(page)).toBeEnabled();
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Remembered breakfast');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast(page)).toContainText('Remembered breakfast');
  await expect.poll(() => state.meals[key]).toBe('Remembered breakfast');
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
  await expect(reopened.getByRole('region', { name: 'Settings', exact: true })).toBeVisible();
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
  await connect(page);
  await expect(breakfast(page)).toBeEnabled();
  await settings(page);
  await expect(page.getByText('Connected for this session only. This browser could not remember access.', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(page)).toBeDisabled();
});

test('invalid tokens are not saved and expired access is replaced without disconnecting', async ({ page, context }) => {
  await fixture(context);
  await context.route('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals**', route => {
    if (route.request().headers().authorization === 'Bearer replacement-test-token') return route.fallback();
    return route.fulfill({ status: 401, json: {} });
  });
  await open(page); await settings(page);
  await expect(page.getByRole('checkbox', { name: 'Remember on this device' })).toHaveCount(0);
  await page.getByLabel('GitHub token').fill('expired-test-token');
  await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
  await expect(page.locator('.app-panel:visible').getByRole('alert')).toContainText('expired or is invalid');
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/'))).toBeNull();
  await page.evaluate(() => localStorage.setItem('speech-to-text-meal-editor:/', 'expired-test-token'));
  await page.reload();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.locator('.app-panel:visible').getByRole('alert')).toContainText('enter a new token');
  await settings(page);
  await expect(page.getByText('Your saved token is no longer working.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disconnect GitHub', exact: true })).toHaveCount(0);
  await page.getByLabel('GitHub token').fill('another-invalid-token');
  await page.getByRole('button', { name: 'Save new token', exact: true }).click();
  await expect(page.locator('.app-panel:visible').getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/'))).toBe('expired-test-token');
  await expect(page.getByLabel('GitHub token')).toHaveValue('another-invalid-token');
  await page.getByLabel('GitHub token').fill('replacement-test-token');
  await page.getByRole('button', { name: 'Save new token', exact: true }).click();
  await expect(page.getByText('GitHub connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/'))).toBe('replacement-test-token');
  await planner(page);
  await expect(breakfast(page)).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(breakfast(page)).toBeEnabled();
});

test('Settings detects expired saved access without first opening a planner', async ({ page, context }) => {
  await fixture(context);
  await page.addInitScript(() => localStorage.setItem('speech-to-text-meal-editor:/', 'expired-test-token'));
  await context.route('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals**', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Your saved token is no longer working.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('GitHub token')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Save new token', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disconnect GitHub', exact: true })).toHaveCount(0);
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
    for (const name of ['Settings', 'Meal planner', 'Shopping list']) await expect(page.getByRole('contentinfo').getByRole('button', { name, exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Settings', exact: true })).toBeVisible();
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
  await expect.poll(() => state.defaults['monday/breakfast']).toBe('Porridge');
  await expect.poll(() => state.meals[key]).toBeUndefined();

  const reader = await context.newPage();
  await open(reader);
  await expect(breakfast(reader)).toContainText('Porridge');
  await expect(breakfast(reader)).toBeEnabled();
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
  await expect.poll(() => state.meals[key]).toBeNull();
  await refreshPlanners(page);
  await expect(breakfast(page)).not.toContainText('Porridge');
  await breakfast(page).click();
  await page.getByRole('button', { name: 'Use weekly default', exact: true }).click();
  await expect(breakfast(page)).toContainText('Porridge');
  await expect.poll(() => state.meals[key]).toBeUndefined();

  await breakfast(page).click();
  await page.getByLabel('Apply to').selectOption('default');
  await page.getByRole('button', { name: 'Remove weekly default', exact: true }).click();
  await expect(breakfast(page)).toContainText('Add meal');
  await expect.poll(() => state.defaults['monday/breakfast']).toBeUndefined();
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(nextBreakfast).toContainText('Eggs');
});

test('default edits preserve dated meals and retain local values on failure or conflict', async ({ page, context }) => {
  const state = await fixture(context);
  state.meals[key] = 'Eggs'; state.defaults['monday/breakfast'] = 'Porridge';
  await open(page); await connect(page); await breakfast(page).click();
  await page.getByLabel('Apply to').selectOption('default');
  await expect(page.getByText(/This date has its own entry/)).toBeVisible();
  await page.locator('#meal-text').fill('Toast'); state.failSave = true;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.app-panel:visible').getByRole('alert')).toContainText('did not save');
  await expect(breakfast(page)).toContainText('Eggs');
  state.failSave = false; state.defaults['monday/breakfast'] = 'Cereal'; state.defaultsRevision++;
  await refreshPlanners(page);
  const conflict = page.getByRole('group', { name: 'Resolve Monday 19 Oct Breakfast weekly default', exact: true });
  await expect(conflict).toContainText('Yours: Toast');
  await expect(conflict).toContainText('Family: Cereal');
  expect(state.meals[key]).toBe('Eggs');
  await conflict.getByRole('button', { name: 'Keep mine', exact: true }).click();
  await refreshPlanners(page);
  await expect.poll(() => state.defaults['monday/breakfast']).toBe('Toast');
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ })).toContainText('Toast');
});

test('changing a working token preserves access on failure and keeps the meal draft on success', async ({ page, context }) => {
  await fixture(context); await open(page); await connect(page);
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Keep this draft');
  await page.getByRole('contentinfo').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Change token', exact: true }).click();
  await expect(page.getByLabel('GitHub token')).toBeFocused();
  await context.route('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals', route => {
    if (route.request().headers().authorization === 'Bearer bad-replacement') return route.fulfill({ status: 401, json: {} });
    return route.fallback();
  });
  await page.getByLabel('GitHub token').fill('bad-replacement');
  await page.getByRole('button', { name: 'Save new token', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('expired or is invalid');
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-meal-editor:/'))).toBe('test-only-token');
  await page.getByLabel('GitHub token').fill('replacement-test-token');
  await page.getByRole('button', { name: 'Save new token', exact: true }).click();
  await expect(page.getByText('GitHub connected', { exact: true })).toBeVisible();
  await page.getByRole('contentinfo').getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.locator('#meal-text')).toHaveValue('Keep this draft');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast(page)).toContainText('Keep this draft');
});

async function weekTouch(target: Locator, type: string, dx = 0, dy = 0, fingers = 1) {
  await target.evaluate((el, { type, dx, dy, fingers }) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : Array.from({ length: fingers }, (_, i) => ({
      identifier: i + 1, clientX: 200 + dx, clientY: 200 + dy,
    })) });
    el.dispatchEvent(event);
  }, { type, dx, dy, fingers });
}
async function swipeWeek(target: Locator, dx: number) {
  await weekTouch(target, 'touchstart');
  await weekTouch(target, 'touchmove', dx);
  await weekTouch(target, 'touchend');
}

for (const width of [390, 1024]) test(`touch swipes change meal weeks and retain drafts at ${width}px`, async ({ page, context }) => {
  const state = await fixture(context);
  state.weeks['2026-10-26'] = { '2026-10-26/breakfast': 'Next week toast' };
  await page.setViewportSize({ width, height: 900 });
  await open(page); await connect(page);
  if (width >= 768) await split(page).click();
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Keep my draft');
  const heading = page.locator('.planner-heading');
  await swipeWeek(heading, -100);
  await expect(page.locator('.week-heading')).toHaveText('26 Oct - 1 Nov, 2026');
  await expect(page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ })).toContainText('Next week toast');
  await swipeWeek(heading, 100);
  await expect(page.locator('.week-heading')).toHaveText('19 Oct - 25 Oct, 2026');
  await expect(page.locator('#meal-text')).toHaveValue('Keep my draft');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await swipeWeek(breakfast(page), 100);
  await expect(page.locator('.week-heading')).toHaveText('12 Oct - 18 Oct, 2026');
  await expect(page.locator('#meal-text')).toHaveCount(0);
  if (width >= 768) await expect(page.getByRole('region', { name: 'Live transcript' })).toBeVisible();
});

test('week swipes ignore vertical, short, cancelled, reversed and multi-touch gestures and editor controls', async ({ page, context }) => {
  await fixture(context); await open(page); await connect(page);
  const heading = page.locator('.planner-heading');
  for (const gesture of ['short', 'vertical', 'cancel', 'reverse', 'multiple']) {
    await weekTouch(heading, 'touchstart');
    await weekTouch(heading, 'touchmove', gesture === 'short' ? -30 : -100, gesture === 'vertical' ? 150 : 0);
    if (gesture === 'reverse') await weekTouch(heading, 'touchmove', 0);
    if (gesture === 'multiple') await weekTouch(heading, 'touchstart', -100, 0, 2);
    await weekTouch(heading, gesture === 'cancel' ? 'touchcancel' : 'touchend');
    await expect(page.locator('.week-heading')).toHaveText('19 Oct - 25 Oct, 2026');
  }
  await breakfast(page).click();
  await page.locator('#meal-text').fill('Keep this text');
  await swipeWeek(page.locator('#meal-text'), -100);
  await swipeWeek(page.getByRole('button', { name: 'Save', exact: true }), -100);
  await expect(page.locator('#meal-text')).toHaveValue('Keep this text');
  await expect(page.locator('.week-heading')).toHaveText('19 Oct - 25 Oct, 2026');
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  await swipeWeek(heading, -100);
  await page.getByRole('button', { name: 'Meal planner', exact: true }).click();
  await expect(page.locator('.week-heading')).toHaveText('19 Oct - 25 Oct, 2026');
  await expect(page.locator('#meal-text')).toHaveValue('Keep this text');
});

test('native touch swipe on a meal card changes one week without opening its editor; taps still edit', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native touch injection uses Chromium CDP; physical Safari remains a manual check.');
  await fixture(context); await page.setViewportSize({ width: 390, height: 844 });
  await open(page); await connect(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await breakfast(page).scrollIntoViewIfNeeded();
  const box = (await breakfast(page).boundingBox())!;
  const point = { x: box.x + box.width - 20, y: box.y + box.height / 2, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  for (const dx of [15, 35, 60, 95]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, x: point.x - dx }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.week-heading')).toHaveText('26 Oct - 1 Nov, 2026');
  await expect(page.locator('#meal-text')).toHaveCount(0);
  const nextMeal = page.getByRole('button', { name: /^Monday 26 Oct, Breakfast:/ });
  await nextMeal.scrollIntoViewIfNeeded();
  const nextBox = (await nextMeal.boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: nextBox.x + nextBox.width / 2, y: nextBox.y + nextBox.height / 2, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#meal-text')).toBeVisible();
});
