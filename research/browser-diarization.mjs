import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
const url = process.env.DIARIZATION_BENCHMARK_URL ?? 'http://localhost:5178/research/diarization-benchmark.html';
for (const [name, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage(); await page.goto(url);
    const run = page.getByRole('button', { name: 'Run speaker turn benchmark' });
    await run.click(); await page.getByText('Complete.', { exact: true }).waitFor({ timeout: 120000 });
    const report = JSON.parse(await page.locator('#report').innerText());
    assert.equal(report.runs.length, 4); assert.equal(report.runs[0].speakers, 0);
    assert(report.runs.slice(1).every((r) => r.segments.length > 0));
    console.log(JSON.stringify({ engine: name, version: browser.version(), ...report }));
    // Cancel during native processing, not merely while fetching files.
    await run.click(); await page.getByText('Processing same-voice-A-A-A…', { exact: true }).waitFor({ timeout: 30000 });
    const start = Date.now(); await page.getByRole('button', { name: 'Cancel', exact: true }).click({ timeout: 2000 });
    assert.equal(await page.locator('#status').innerText(), 'Cancelled.'); assert(Date.now() - start < 2000);
    await run.click(); await page.getByText('Processing same-voice-A-A-A…', { exact: true }).waitFor({ timeout: 30000 });
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.equal(await page.locator('#status').innerText(), 'Cancelled.');
    await page.route('**/model.int8.onnx', (route) => route.abort()); await run.click();
    await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.notEqual(await page.locator('#status').innerText(), 'Complete.');
    console.log(`${name}: native-processing cancellation, pagehide and failed download recovered.`);
  } finally { await browser.close(); }
}
