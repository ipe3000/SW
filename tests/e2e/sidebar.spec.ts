import { test, expect, type Page } from '@playwright/test';
import { newMatch, defaultOptions, wizard, type Match } from '../../src/engine/game';
import { matchMenu, closeMenu } from './ui';

const sizes = [[1366, 768], [1280, 720], [1024, 480], [800, 400], [390, 844], [390, 667], [360, 640], [667, 375], [740, 360]];
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('sw-presentation-mode', 'instant')); });
async function open(page: Page, match: Match) {
  await page.goto('./'); await page.getByTestId('import-game').setInputFiles({ name: 'sidebar.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(match)) });
  await expect(page.locator('.board-grid')).toBeVisible();
}
async function fits(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const containers = [...document.querySelectorAll<HTMLElement>('.game-heading, .console-scroll, .action-dock, .deployment-dock')];
    return {
      pageFits: document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth,
      controlsFit: containers.every(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && el.scrollHeight <= el.clientHeight + 1; }),
      fieldFits: (() => { const r = document.querySelector('.board-frame')!.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })(),
      scrollingAvailable: !['hidden', 'clip'].includes(getComputedStyle(document.querySelector('.app-shell')!).overflowY),
    };
  })).toEqual({ pageFits: true, controlsFit: true, fieldFits: true, scrollingAvailable: true });
}
async function matrix(page: Page, name: string) {
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await fits(page);
    if (width === 1366 || width === 390 && height === 667) await page.screenshot({ path: `test-results/sidebar-${name}-${width}-${height}.png` });
  }
}
test('pagina intera a zoom 100%: selezione, consultazione e preparazione del potere', async ({ page }) => {
  const m = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); m.game.turn = 2;
  wizard(m.game, 'red:teleporter')!.pos = { x: 4, y: 4 }; wizard(m.game, 'blue:spellsword')!.pos = { x: 2, y: 4 };
  await open(page, m); await matrix(page, 'idle');
  await expect(page.locator('.play-console .game-history')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rivedi ultimo turno avversario' })).toHaveCount(0);
  await page.locator('[data-square="E6"]').click();
  await expect(page.getByRole('region', { name: 'Mago in preparazione' })).toBeVisible();
  await page.getByRole('button', { name: 'Prepara abilità', exact: true }).click(); await page.locator('[data-square="C6"]').click(); await page.locator('[data-square="G6"]').click();
  await matrix(page, 'spell');
  await page.getByRole('button', { name: 'Dettagli', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('si applica solo dopo'); await page.keyboard.press('Escape'); await fits(page);
  await page.locator('[data-wizard-id="blue:geomancer"]').click();
  await expect(page.getByRole('region', { name: 'Mago consultato' })).toBeVisible();
  await expect(page.locator('.draft-budget')).toContainText('Teletrasportatore'); await fits(page);
  await matchMenu(page, 'Partita'); await expect(page.locator('.game-menu-dialog .game-history')).toBeVisible(); await closeMenu(page);
});
test('schieramento: tutti i maghi selezionabili e nessuno scroll', async ({ page }) => {
  await open(page, newMatch({ ...defaultOptions, placement: 'custom' }, () => .8));
  await expect(page.getByRole('button', { name: /^Schiera / })).toHaveCount(8);
  await matrix(page, 'deployment');
});
test('osservazione e pausa: solo comandi pertinenti, stato coerente', async ({ page }) => {
  const m = newMatch(defaultOptions, () => .8); m.computer = { side: 'both', profile: 'didactic-v1', speed: 'slowest' };
  await open(page, m); await page.getByRole('button', { name: 'Pausa duello', exact: true }).click();
  await expect(page.getByTestId('computer-state')).toHaveText('Computer in pausa');
  await expect(page.getByRole('button', { name: 'Prepara abilità', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Conferma/ })).toHaveCount(0);
  await expect(page.locator('.play-console')).not.toContainText('Il computer sta giocando');
  await matrix(page, 'paused');
});
test('animazione: controlli e dettagli restano accessibili', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sw-presentation-mode', 'manual'));
  await page.goto('./'); await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  await page.locator('[data-wizard-id="red:aeromancer"]').click(); await page.locator('[data-square="F2"]').click(); await page.locator('.confirm-activation').click();
  await matrix(page, 'animation');
  await page.getByRole('button', { name: 'Dettagli azione' }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('button', { name: 'Mostra esito' }).click(); await fits(page);
});
