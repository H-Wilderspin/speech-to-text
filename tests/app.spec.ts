import { expect, test, type Page } from '@playwright/test';

async function mockRecognition(page: Page) {
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void;
      onend?: () => void;
      onresult?: (event: unknown) => void;
      onerror?: (event: unknown) => void;
      start() { Object.assign(window, { testRecognition: this }); this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { Object.assign(window, { wasAborted: true }); queueMicrotask(() => this.onend?.()); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
}

async function result(page: Page, text: string, isFinal: boolean) {
  await page.evaluate(({ text, isFinal }) => {
    const host = window as Window & { testRecognition?: { onresult: (event: unknown) => void } };
    host.testRecognition?.onresult({ results: [{ 0: { transcript: text, confidence: .9 }, length: 1, isFinal }] });
  }, { text, isFinal });
}

for (const availability of ['supported', 'denied', 'missing'] as const) test(`screen wake lock: ${availability}`, async ({ page }) => {
  await mockRecognition(page);
  await page.addInitScript((availability) => {
    const counters = { requested: 0, released: 0 };
    Object.assign(window, { wakeCounters: counters });
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: availability === 'missing' ? undefined : {
      request: async (type: string) => {
        if (type !== 'screen') throw new Error('Wrong wake lock type');
        counters.requested += 1;
        if (availability === 'denied') throw new DOMException('Denied', 'NotAllowedError');
        return Object.assign(new EventTarget(), { released: false, release: async () => { counters.released += 1; } });
      },
    } });
  }, availability);
  const counters = () => page.evaluate(() => (window as Window & { wakeCounters?: { requested: number; released: number } }).wakeCounters);
  await page.goto('/');
  expect(await counters()).toEqual({ requested: 0, released: 0 });
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'Reading without touching the screen.', true);
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('Reading without touching the screen.');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText(availability === 'supported' ? 'Keeping screen awake.' : 'Screen may sleep. Check your device’s Auto-Lock settings.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await result(page, 'Still listening after Clear.', true);
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('Still listening after Clear.');
  expect(await counters()).toEqual({ requested: availability === 'missing' ? 0 : 1, released: 0 });
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect.poll(counters).toEqual({ requested: availability === 'missing' ? 0 : 1, released: availability === 'supported' ? 1 : 0 });
  if (availability === 'supported') {
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await result(page, 'command stop', true);
    await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
    await expect.poll(counters).toEqual({ requested: 2, released: 2 });
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
    await expect.poll(counters).toEqual({ requested: 3, released: 3 });
  }
});

test('light live captions remember text preferences', async ({ page }) => {
  await mockRecognition(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Larger text' }).click();
  await page.getByLabel('Speech language').selectOption('en-US');
  await page.screenshot({ path: `test-results/settings-${test.info().project.name}.png` });
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Speech language')).toHaveValue('en-US');
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'All speech appears immediately here.', false);
  const live = page.getByRole('region', { name: 'Live transcript', exact: true });
  await expect(live).toContainText('All speech appears immediately here.');
  await result(page, 'All speech appears immediately here.', true);
  await expect(live).toHaveCSS('font-size', '36px');
  await expect(live.locator('.caption')).toHaveCSS('color', 'rgb(27, 39, 58)');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(247, 249, 250)');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
});

test('anonymous listening, interim revision, stop, resume, clear, and no persistence', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toHaveAttribute('aria-describedby', 'processing-note');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'a blue', false); await result(page, 'a new day', true);
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('A new day');
  await expect(page.getByText('a blue', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'Another thought.', true);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.confirmed')).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.confirmed')).toHaveCount(0);
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'Memory only.', true); await page.reload();
  await expect(page.getByText('Memory only.', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

for (const android of [false, true]) test(`Clear retires capture and rejects stale callbacks (${android ? 'Android' : 'standard'})`, async ({ page }) => {
  await mockRecognition(page);
  if (android) await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Linux; Android 10; K) Chrome/156.0.0.0 Mobile Safari/537.36',
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'We are', false);
  const live = page.getByRole('region', { name: 'Live transcript', exact: true });
  const session = Number(await live.locator('.caption').getAttribute('data-session'));
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onresult?: (event: unknown) => void; onerror?: (event: unknown) => void; onend?: () => void } };
    Object.assign(window, { oldCallbacks: { ...host.testRecognition }, originalRecognition: host.testRecognition });
  });
  const clear = page.getByRole('button', { name: 'Clear', exact: true });
  await expect(clear).toBeEnabled(); await clear.click();
  await expect(live.locator('.caption')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await expect(clear).toBeDisabled();
  await page.evaluate(() => {
    const old = (window as Window & { oldCallbacks?: { onresult?: (event: unknown) => void; onerror?: (event: unknown) => void; onend?: () => void } }).oldCallbacks;
    old?.onresult?.({ results: [{ 0: { transcript: 'We were ready before Clear.', confidence: .9 }, length: 1, isFinal: true }] });
    old?.onerror?.({ error: 'network' }); old?.onend?.();
  });
  await expect(live.locator('.caption')).toHaveCount(0);
  await result(page, 'We were ready to go.', true);
  await expect(live.locator('.caption')).toHaveCount(1);
  await expect(live).toContainText('We were ready to go.');
  await expect(live.locator('.caption')).toHaveAttribute('data-session', String(session + 1));
  expect(await page.evaluate(() => {
    const host = window as Window & { testRecognition?: unknown; originalRecognition?: unknown; wasAborted?: boolean };
    return host.testRecognition !== host.originalRecognition && host.wasAborted;
  })).toBe(true);
  await clear.click();
  await expect(live.locator('.caption')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(live.locator('.caption')).toHaveCount(0);
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'A fresh sentence.', true);
  await expect(live.locator('.caption')).toHaveCount(1);
  await expect(live).toContainText('A fresh sentence.');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
});

for (const android of [false, true]) test(`command clear clears captions and continues listening (${android ? 'Android' : 'standard'})`, async ({ page }) => {
  await mockRecognition(page);
  if (android) await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Linux; Android 10; K) Chrome/156.0.0.0 Mobile Safari/537.36',
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  const live = page.getByRole('region', { name: 'Live transcript', exact: true });
  await result(page, 'Old words. Command clear.', false);
  await expect(live).toContainText('Old words.');
  const completed = 'Old words. Command clear. Old payload tail.';
  await result(page, completed, true);
  if (android) await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onend: () => void } };
    host.testRecognition?.onend();
  });
  await expect(live.locator('.caption')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await result(page, 'Fresh words.', false);
  await expect(live.locator('.caption p')).toHaveText(['Fresh words. Unconfirmed']);
  await result(page, 'Fresh words. Command stop.', true);
  if (android) await page.evaluate(() => {
    (window as Window & { testRecognition?: { onend?: () => void } }).testRecognition?.onend?.();
  });
  await expect(live.locator('.caption p')).toHaveText(['Fresh words.']);
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
});

test('a provider pause separates growing lines without freezing a late correction', async ({ page }) => {
  await mockRecognition(page); await page.goto('/'); await page.clock.install();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  const lines = page.getByRole('region', { name: 'Live transcript' }).locator('.caption p');
  await result(page, 'A quiet morning', false);
  await page.evaluate(() => (window as Window & { testRecognition?: { onspeechend?: () => void } }).testRecognition?.onspeechend?.());
  await page.clock.fastForward(500);
  await result(page, 'A quiet morning. A new thought', false);
  await expect(lines).toHaveText(['A quiet morning. Unconfirmed', ' A new thought Unconfirmed']);
  await result(page, 'A quiet morning. A new thought develops.', false);
  await expect(lines).toHaveText(['A quiet morning. Unconfirmed', ' A new thought develops. Unconfirmed']);
  await result(page, 'A bright morning. A new thought develops.', true);
  await expect(lines).toHaveText(['A bright morning. A new thought develops.']);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
});

test('caption formatting follows revisions and language without changing voice commands', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  const lines = page.getByRole('region', { name: 'Live transcript' }).locator('.caption p');
  await result(page, 'hello grandad. i can', false);
  await expect(lines).toHaveText(['Hello grandad. I can Unconfirmed']);
  await result(page, 'hello grandma. would you like tea ? i’m ready and NASA agrees.', true);
  await expect(lines).toHaveText(['Hello grandma. Would you like tea? I’m ready and NASA agrees.']);
  await result(page, 'hello grandma. would you like tea ? i’m ready and NASA agrees. command clear', true);
  await expect(lines).toHaveCount(0);
  await result(page, 'a new line. i can help. command stop', true);
  await expect(lines).toHaveText(['A new line. I can help.']);
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Speech language').selectOption('es-ES');
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'hola i adiós. qué tal?', true);
  await expect(lines).toHaveText(['Hola i adiós. Qué tal?']);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
});

test('permission denial is actionable and a new gesture can recover', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onerror: (event: unknown) => void } };
    host.testRecognition?.onerror({ error: 'not-allowed' });
  });
  await expect(page.locator('#captions > [role=status]')).toContainText('site settings');
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.locator('.listening-indicator')).toHaveText('Listening…');
});

test('bottom icon controls leave the viewport to captions and settings preserve an active session', async ({ page }) => {
  await mockRecognition(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.getByRole('contentinfo').getByRole('button')).toHaveText(['Listen', '', '', '', '', '']);
  for (const name of ['Clear', 'Meal planner', 'Task planner', 'Shopping list', 'Settings']) await expect(page.getByRole('contentinfo').getByRole('button', { name, exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled();
  const transcript = page.getByRole('region', { name: 'Live transcript' });
  const box = await transcript.boundingBox();
  const controls = await page.getByRole('contentinfo', { name: 'Caption controls' }).boundingBox();
  expect(controls!.y + controls!.height).toBe(844);
  expect(box!.y + box!.height).toBeLessThanOrEqual(controls!.y);
  expect(box!.height).toBeGreaterThan(650);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Speech language').selectOption('en-US');
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'The captions fill this page.', true);
  await expect(page.getByRole('contentinfo').getByRole('button')).toHaveText(['Stop', '', '', '', '', '']);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Speech language')).toBeDisabled();
  await page.getByRole('button', { name: 'Larger text' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await expect(page.locator('.confirmed')).toHaveText('The captions fill this page.');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('.confirmed')).toHaveCount(0);
  await page.screenshot({ path: `test-results/clean-page-${test.info().project.name}.png` });
});

test('Poppins settings centre, preview size and dismiss only outside the panel', async ({ page }) => {
  await mockRecognition(page); await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'A clear live sentence.', true);
  const text = page.getByRole('region', { name: 'Live transcript' }).locator('p.confirmed');
  await expect(text).toHaveCSS('font-weight', '400');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('400 32px Poppins') && document.fonts.check('600 14px Poppins'))).toBe(true);
  await expect(page.locator('body')).toHaveCSS('font-family', 'Poppins, sans-serif');
  const dialog = page.getByRole('dialog');
  expect(await dialog.boundingBox()).toEqual({ x: 220, y: 0, width: 1000, height: 900 });
  await expect(page.locator('.settings-content > section').first()).toHaveAttribute('aria-label', 'App updates');
  await expect(page.getByRole('region', { name: 'Caption preferences' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Text size', exact: true })).toHaveCount(0);
  await expect(page.locator('#text-size-label')).toHaveCSS('text-transform', 'uppercase');
  await expect(page.locator('#text-size-label')).toHaveCSS('letter-spacing', '2.8px');
  await expect(page.locator('.size-preview')).toHaveCSS('font-size', '32px');
  await page.getByRole('button', { name: 'Larger text' }).click();
  await expect(page.locator('.size-preview')).toHaveCSS('font-size', '36px');
  await expect(page.getByLabel('Speech language')).toBeDisabled();
  const controls = await page.locator('.display-control').evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width };
  }));
  expect(controls[0]!.width).toBe(controls[1]!.width);
  expect(controls[0]!.y).toBe(controls[1]!.y);
  expect(controls[1]!.x).toBeGreaterThan(controls[0]!.x + controls[0]!.width);
  await page.screenshot({ path: `test-results/settings-desktop-${test.info().project.name}.png` });
  // An inside click or a drag out of the panel must not dismiss it.
  await page.locator('#settings-title').click(); await expect(dialog).toBeVisible();
  await page.mouse.move(600, 40); await page.mouse.down(); await page.mouse.move(40, 40); await page.mouse.up();
  await expect(dialog).toBeVisible();
  await page.mouse.click(40, 150); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await expect(text).toHaveText('A clear live sentence.');
  await expect(text).toHaveCSS('font-size', '36px');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
});

test('growing hypotheses render once, listening restarts, and a spoken command stops it', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  for (let count = 1; count <= 3; count++) {
    await page.evaluate((count) => {
      const host = window as Window & { testRecognition?: { onresult: (event: unknown) => void } };
      host.testRecognition?.onresult({ results: ['We', 'We are', 'We are here.'].slice(0, count).map((text) => ({
        0: { transcript: text, confidence: .9 }, length: 1, isFinal: true,
      })) });
    }, count);
  }
  await expect(page.locator('.confirmed')).toHaveText(['We are here.']);
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onend: () => void }; previousRecognition?: unknown };
    host.previousRecognition = host.testRecognition;
    host.testRecognition?.onend();
  });
  await expect.poll(() => page.evaluate(() => {
    const host = window as Window & { testRecognition?: unknown; previousRecognition?: unknown };
    return host.testRecognition !== host.previousRecognition;
  })).toBe(true);
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await result(page, 'All finished. Command stop.', true);
  await expect(page.locator('#captions > [role=status]')).toContainText('Stopped by voice command');
  await expect(page.locator('.confirmed')).toHaveText(['We are here.', 'All finished.']);
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as Window & { wasAborted?: boolean }).wasAborted)).toBe(true);
});

test('continuous recognition keeps sentence openings after a pause and honours voice Stop', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await page.clock.install();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { continuous: boolean; onspeechstart: () => void }; pausedRecognition?: unknown };
    if (!host.testRecognition?.continuous) throw new Error('Single-utterance recognition leaves a capture gap.');
    host.pausedRecognition = host.testRecognition;
    host.testRecognition.onspeechstart();
  });
  await result(page, 'We are here.', true);
  await page.clock.fastForward(15_000);
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onspeechstart: () => void; onresult: (event: unknown) => void }; pausedRecognition?: unknown };
    if (!host.testRecognition || host.testRecognition !== host.pausedRecognition) throw new Error('Native capture restarted during the pause.');
    host.testRecognition.onspeechstart();
    host.testRecognition.onresult({ results: ['We are here.', 'We are here again. Command stop.'].map((text) => ({
      0: { transcript: text, confidence: .9 }, length: 1, isFinal: true,
    })) });
  });
  await expect(page.locator('.confirmed')).toHaveText(['We are here.', 'We are here again.']);
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as Window & { wasAborted?: boolean }).wasAborted)).toBe(true);
});

test('Android cumulative final-marked revisions update one line, including corrections and identical repeats', async ({ page }) => {
  await mockRecognition(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Linux; Android 10; K) Chrome/156.0.0.0 Mobile Safari/537.36',
  }));
  await page.goto('/'); await page.clock.install();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  for (let count = 1; count <= 6; count++) {
    await page.evaluate((count) => {
      const host = window as Window & { testRecognition?: { continuous: boolean; onspeechstart: () => void; onresult: (event: unknown) => void } };
      if (!host.testRecognition?.continuous) throw new Error('Android must keep continuous mode.');
      host.testRecognition.onspeechstart();
      host.testRecognition.onresult({ results: ['We', 'We', 'We are', 'We are hear', 'We are here.', 'We are here.'].slice(0, count).map((text) => ({
        0: { transcript: text, confidence: 0 }, length: 1, isFinal: true,
      })) });
    }, count);
    await expect(page.locator('.caption')).toHaveCount(1);
  }
  await expect(page.locator('.interim')).toContainText('We are here.');
  await expect(page.locator('.confirmed')).toHaveCount(0);
  await page.clock.fastForward(15_000);
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onresult: (event: unknown) => void; onend: () => void } };
    host.testRecognition?.onresult({ results: ['We are here.', 'We are here. Now another sentence. Command stop.'].map((text) => ({
      0: { transcript: text, confidence: 0 }, length: 1, isFinal: true,
    })) });
    host.testRecognition?.onend();
  });
  await expect(page.locator('.confirmed')).toHaveText(['We are here. Now another sentence.']);
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as Window & { wasAborted?: boolean }).wasAborted)).toBe(true);
});

test('Android keeps a deliberately repeated sentence from a later native session', async ({ page }) => {
  await mockRecognition(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Linux; Android 10; K) Chrome/156.0.0.0 Mobile Safari/537.36',
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'Yes, very very good.', true);
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onend: () => void }; previousRecognition?: unknown };
    host.previousRecognition = host.testRecognition;
    host.testRecognition?.onend();
  });
  await expect.poll(() => page.evaluate(() => {
    const host = window as Window & { testRecognition?: unknown; previousRecognition?: unknown };
    return host.testRecognition !== host.previousRecognition;
  })).toBe(true);
  await result(page, 'Yes, very very good.', true);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.confirmed')).toHaveText(['Yes, very very good.', 'Yes, very very good.']);
});

test('unsupported capability preserves readable UI and accessible settings dialog', async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { SpeechRecognition: undefined, webkitSpeechRecognition: undefined }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('does not offer');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to captions' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
});

test('page interruption aborts the microphone without clearing confirmed speech', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click(); await result(page, 'Keep this.', true);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.locator('#captions > [role=status]')).toContainText('left the app');
  await expect(page.locator('.confirmed')).toHaveText('Keep this.');
  expect(await page.evaluate(() => (window as Window & { wasAborted?: boolean }).wasAborted)).toBe(true);
});

test('320px and larger text do not create horizontal overflow', async ({ page }) => {
  await mockRecognition(page); await page.setViewportSize({ width: 320, height: 740 }); await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Larger text' }).click();
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'LongUnbrokenWord'.repeat(20), true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.getByRole('region', { name: 'Live transcript', exact: true }).evaluate((element) => getComputedStyle(element).fontSize)).toBe('56px');
  await page.screenshot({ path: `test-results/mobile-${test.info().project.name}.png`, fullPage: true });
});

test('offline shell opens without claiming offline recognition', async ({ page, context }) => {
  await mockRecognition(page); await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByText('You’re offline.', { exact: false })).toBeVisible();
  const cachedUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).map((entry) => entry.url)))).flat();
  });
  expect(cachedUrls.every((url) => url.startsWith('http://127.0.0.1:4173/'))).toBe(true);
  expect(cachedUrls.some((url) => url.endsWith('index.html'))).toBe(true);
});

test('subdirectory deployment installs scoped assets and opens offline', async ({ page, context }) => {
  await mockRecognition(page);
  await page.goto('http://127.0.0.1:4174/speech-to-text/');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  const scope = await page.evaluate(() => navigator.serviceWorker.ready.then((registration) => registration.scope));
  expect(scope).toBe('http://127.0.0.1:4174/speech-to-text/');
  const manifestResponse = await page.request.get(`${scope}manifest.webmanifest`);
  const manifest = await manifestResponse.json() as { icons: { src: string }[]; start_url: string };
  expect(manifest.start_url).toBe('./');
  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, scope).href);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  await page.reload(); await context.setOffline(true); await page.reload();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByText('You’re offline.', { exact: false })).toBeVisible();
  const fonts = await page.evaluate(async () => Promise.all(['Poppins-Regular.ttf', 'Poppins-SemiBold.ttf'].map(async (file) => {
    const response = await fetch(`./fonts/${file}`); return { ok: response.ok, bytes: (await response.arrayBuffer()).byteLength };
  })));
  expect(fonts).toEqual([{ ok: true, bytes: 160316 }, { ok: true, bytes: 157312 }]);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('400 32px Poppins'))).toBe(true);
});

test('live sentences compose inline in chronological order without split or duplicate text', async ({ page }) => {
  await mockRecognition(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  const live = page.getByRole('region', { name: 'Live transcript', exact: true });
  await result(page, 'We are', false);
  await live.locator('.caption').evaluate((element) => element.setAttribute('data-original-caption', 'true'));
  await result(page, 'We are reading a longer sentence as it grows across several lines.', false);
  await expect(live.locator('.caption')).toHaveCount(1);
  await expect(live.locator('[data-original-caption]')).toContainText('We are reading a longer sentence as it grows across several lines.');
  await result(page, 'We are reading a longer sentence as it grows across several lines.', true);
  await expect(live.locator('[data-original-caption] p')).toHaveClass('confirmed');
  for (const [text, isFinal] of [['The next sentence', false], ['The next sentence stays complete.', true]] as const) {
    await page.evaluate(({ text, isFinal }) => {
      const host = window as Window & { testRecognition?: { onresult: (event: unknown) => void } };
      host.testRecognition?.onresult({ results: [
        { 0: { transcript: 'We are reading a longer sentence as it grows across several lines.', confidence: .9 }, length: 1, isFinal: true },
        { 0: { transcript: text, confidence: .9 }, length: 1, isFinal },
      ] });
    }, { text, isFinal });
    await expect(live.locator('.caption')).toHaveCount(2);
    await expect(live.locator('.caption').last()).toContainText(text);
  }
  await expect(live.locator('p')).toHaveText(['We are reading a longer sentence as it grows across several lines.', 'The next sentence stays complete.']);
  await expect(live.getByRole('region')).toHaveCount(0);
  const first = await live.locator('.caption').first().boundingBox();
  const second = await live.locator('.caption').last().boundingBox();
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
  await page.screenshot({ path: `test-results/inline-live-${test.info().project.name}.png` });
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(live.locator('.confirmed')).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(live.locator('.caption')).toHaveCount(0);
  await expect(page.getByText('Tap Listen to start.', { exact: true })).toBeVisible();
});

test('reading earlier speech preserves scroll and returning to bottom resumes following', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'A readable sentence. '.repeat(200), true);
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onresult: (event: unknown) => void } };
    host.testRecognition?.onresult({ results: [
      { 0: { transcript: 'A readable sentence. '.repeat(200), confidence: .9 }, length: 1, isFinal: true },
      { 0: { transcript: 'The newest thought.', confidence: .9 }, length: 1, isFinal: true },
    ] });
  });
  const region = page.getByRole('region', { name: 'Live transcript', exact: true });
  await region.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
  await expect(page.getByRole('contentinfo').getByRole('button')).toHaveCount(6);
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onresult: (event: unknown) => void } };
    host.testRecognition?.onresult({ results: [
      { 0: { transcript: 'A readable sentence. '.repeat(200), confidence: .9 }, length: 1, isFinal: true },
      { 0: { transcript: 'The newest thought.', confidence: .9 }, length: 1, isFinal: true },
      { 0: { transcript: 'Another thought.', confidence: .9 }, length: 1, isFinal: true },
    ] });
  });
  expect(await region.evaluate((element) => element.scrollTop)).toBe(0);
  await region.evaluate((element) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll')); });
  expect(await region.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
});
