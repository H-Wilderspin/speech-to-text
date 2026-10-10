import { chromium, webkit, expect } from '@playwright/test';

const target = process.env.SPEAKER_BENCHMARK_URL ?? 'http://localhost:5178/research/speaker-benchmark.html';
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(target);
    await page.getByRole('button', { name: 'Run synthetic benchmark' }).click();
    await page.waitForFunction(() => ['complete', 'error'].includes(document.querySelector('#report').dataset.status), null, { timeout: 65_000 });
    const state = await page.locator('#report').getAttribute('data-status');
    if (state !== 'complete') throw new Error(`${name}: ${await page.locator('#status').textContent()}`);
    const report = JSON.parse(await page.locator('#report').textContent());
    expect(report.runs).toHaveLength(3);
    expect(report.runs.every((run) => run.dimension === 512 && run.finiteNonzero)).toBe(true);
    console.log(JSON.stringify({ engine: name, ...report }));

    await page.getByRole('button', { name: 'Run synthetic benchmark' }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('#report')).toHaveAttribute('data-status', 'cancelled');
    await expect(page.getByRole('button', { name: 'Run synthetic benchmark' })).toBeEnabled();

    await context.route('**/embedding.onnx', (route) => route.abort());
    await page.getByRole('button', { name: 'Run synthetic benchmark' }).click();
    await expect(page.locator('#report')).toHaveAttribute('data-status', 'error', { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Run synthetic benchmark' })).toBeEnabled();
    console.log(`${name}: cancellation and model-download failure recovered`);
  } finally { await browser.close(); }
}
