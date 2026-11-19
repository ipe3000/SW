import { test, expect } from '@playwright/test';
import { defaultOptions, newMatch } from '../../src/engine/game';

for (const failure of ['cancelled', 'unsettled'] as const) {
  test(`il computer riprende senza refresh dopo animazione ${failure}`, async ({ page }) => {
    await page.addInitScript(({ failure }) => {
      localStorage.setItem('sw-presentation-mode', 'automatic');
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args);
        if (this.classList.contains('moving-piece')) {
          document.documentElement.dataset.interruptedMotion = failure;
          if (failure === 'cancelled') queueMicrotask(() => animation.cancel());
          else Object.defineProperty(animation, 'finished', { value: new Promise(() => {}) });
        }
        return animation;
      };
    }, { failure });
    const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
    match.game.turn = 2;
    match.computer = { profile: 'didactic-v1', side: 'red', difficulty: { red: 'easy' } };
    await page.goto('./');
    await page.getByTestId('import-game').setInputFiles({ name: 'recovery.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(match)) });
    await expect(page.locator('html')).toHaveAttribute('data-interrupted-motion', failure);
    if (failure === 'unsettled') {
      await expect(page.locator('[data-moving-piece]')).toBeVisible();
      await page.getByRole('button', { name: 'Pausa duello', exact: true }).click();
      const revision = await page.getByTestId('computer-state').getAttribute('data-revision');
      const motion = await page.locator('[data-moving-piece]').getAttribute('data-motion-id');
      await page.waitForTimeout(1200);
      await expect(page.getByTestId('computer-state')).toHaveAttribute('data-revision', revision!);
      await expect(page.locator('[data-moving-piece]')).toHaveAttribute('data-motion-id', motion!);
      await page.getByRole('button', { name: 'Riprendi duello', exact: true }).click();
    }
    await expect(page.getByTestId('computer-state')).toHaveText('Tocca a te', { timeout: 15000 });
    await expect(page.locator('[data-moving-piece]')).toHaveCount(0);
    expect(Number(await page.getByTestId('computer-state').getAttribute('data-revision'))).toBeGreaterThan(1);
  });
}
