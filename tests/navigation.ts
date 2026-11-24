import { type Page } from '@playwright/test';

export async function refreshPlanners(page: Page) {
  const button = page.getByRole('button', { name: 'Refresh', exact: true });
  if (await button.isVisible()) {
    await button.click();
    return;
  }
  await page.locator('.planner-panel').evaluate(el => { el.scrollTop = 0; });
  await page.locator('.planner-heading').evaluate(el => {
    const rect = el.getBoundingClientRect();
    for (const [type, distance] of [['touchstart', 0], ['touchmove', 90], ['touchend', 90]] as const) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [
        { identifier: 1, clientX: rect.x + 20, clientY: rect.y + 10 + distance },
      ] });
      el.dispatchEvent(event);
    }
  });
}

/** Toggle the currently visible app through its global footer action. */
export async function toggleCurrentPanel(page: Page) {
  const name = await page.locator('.app-panel:visible > header h2').innerText();
  await page.getByRole('contentinfo').getByRole('button', { name, exact: true }).click();
}
