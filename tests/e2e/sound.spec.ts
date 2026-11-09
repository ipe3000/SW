import { expect, test } from '@playwright/test';

test('audio fantasy: riproduzione, silenziamento e preferenza persistente', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const tracked = window as Window & { soundNotes?: number };
      tracked.soundNotes = (tracked.soundNotes ?? 0) + 1;
      return original.call(this);
    };
  });
  await page.goto('./');
  const toggle = page.getByRole('button', { name: 'Effetti sonori', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => (window as Window & { soundNotes?: number }).soundNotes ?? 0)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
