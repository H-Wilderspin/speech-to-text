import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
const url = process.env.ASR_BENCHMARK_URL ?? 'http://localhost:5178/research/asr-benchmark.html';
for (const [name, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage(); await page.goto(url);
    await page.getByRole('button', { name: 'Run ASR benchmark' }).click();
    await page.getByText('Complete.', { exact: true }).waitFor({ timeout: 60000 });
    const report = JSON.parse(await page.locator('#report').innerText());
    assert.equal(report.runs.length, 2); assert(report.runs.every((run) => run.finals.length >= 2));
    console.log(JSON.stringify({ engine: name, version: browser.version(), ...report }, null, 2));
    await page.getByRole('button', { name: 'Run ASR benchmark' }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.locator('#status').innerText(), 'Cancelled.');
    await page.route('**/encoder.onnx', (route) => route.abort());
    await page.getByRole('button', { name: 'Run ASR benchmark' }).click();
    await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.notEqual(await page.locator('#status').innerText(), 'Complete.');
    console.log(`${name}: cancellation and aborted model download recovered.`);
  } finally { await browser.close(); }
}
