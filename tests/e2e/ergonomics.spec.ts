import { test, expect, type Page } from '@playwright/test';
import { newMatch, defaultOptions, wizard, type Match } from '../../src/engine/game';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('sw-presentation-mode', 'instant')); });
const cell = (page: Page, square: string) => page.locator(`[data-square="${square}"]`);
const confirm = (page: Page) => page.locator('.confirm-activation');
async function move(page: Page, id: string, square: string) { await page.locator(`[data-wizard-id="${id}"]`).click(); await cell(page, square).click(); await expect(confirm(page)).toBeEnabled(); await confirm(page).click(); }
async function menu(page: Page, selector: string) { const details = page.locator(selector); if (!(await details.evaluate(el => (el as HTMLDetailsElement).open))) await details.locator(':scope > summary').click(); }
async function exported(page: Page) { await menu(page, '.match-menu'); const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Esporta partita', exact: true }).click(); return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as Match; }
async function open(page: Page, match: Match) { await page.goto('./'); await page.getByTestId('import-game').setInputFiles({ name: 'ergonomics.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(match)) }); }
async function completedEnemyTurn(page: Page) {
  await page.goto('./'); await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  await move(page, 'red:aeromancer', 'F2');
  await move(page, 'blue:aeromancer', 'E9'); await move(page, 'blue:electromancer', 'I9'); await move(page, 'blue:illusionist', 'D9');
  await expect(page.locator('.game-heading h1')).toHaveText('Il turno di Gilda Rossa.');
}

test('comandi fermi, board a tutta altezza e ispezione nemica senza perdere la preparazione', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('./'); await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  const before = await confirm(page).boundingBox(), board = await page.locator('.board-grid').boundingBox();
  expect(board!.height).toBeGreaterThan(768 * .9);
  await page.locator('[data-wizard-id="red:aeromancer"]').click(); await cell(page, 'F2').click();
  const after = await confirm(page).boundingBox(); expect(Math.abs(after!.y-before!.y)).toBeLessThan(1);
  await page.locator('[data-wizard-id="blue:geomancer"]').click();
  await expect(page.locator('.mage-card h3')).toHaveText('Geomante');
  await expect(page.locator('.draft-budget')).toContainText('Aeromante');
  await expect(cell(page, 'F2')).toHaveAttribute('data-wizard-id', 'red:aeromancer');
  await expect(page.getByRole('button', { name: 'Termina turno', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Attiva suoni' })).not.toBeVisible();
  await menu(page, '.settings-menu'); await expect(page.getByRole('button', { name: 'Attiva suoni' })).toBeVisible();
  expect(await confirm(page).boundingBox()).toEqual(after);
  await page.screenshot({ path: 'test-results/ergonomic-desktop.png' });
});

test('prima conferma passa la mano e il passo extra conclude senza un secondo comando', async ({ page }) => {
  await completedEnemyTurn(page);
  const state = await exported(page);
  expect(state.revision).toBe(4); expect(state.game.turn).toBe(2); expect(state.undo).toEqual([]);
  expect(state.replays?.red?.entries).toHaveLength(1); expect(state.replays?.blue?.entries).toHaveLength(3);
  await expect(page.getByRole('button', { name: 'Annulla attivazione', exact: true })).toBeDisabled();
});

test('replay completo, automatico anche con animazioni immediate, minimale e senza scritture', async ({ page }) => {
  await completedEnemyTurn(page); const before = await exported(page); await page.reload();
  const replay = page.getByRole('button', { name: 'Rivedi ultimo turno avversario' }); await expect(replay).toBeEnabled(); await replay.click();
  await expect(page.getByTestId('action-presentation')).toHaveAttribute('data-replaying', 'true');
  await expect(page.locator('.action-presentation button')).toHaveCount(1);
  await expect(page.locator('.action-presentation select')).toHaveCount(0);
  const actors = await page.evaluate(async () => {
    const actors = new Set<string>();
    for (let i=0;i<300;i++) {
      const node = document.querySelector('[data-testid="action-presentation"]')!;
      if (node.getAttribute('data-actor')) actors.add(node.getAttribute('data-actor')!);
      if (node.getAttribute('data-replaying') !== 'true') break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return [...actors];
  });
  expect(actors).toEqual(expect.arrayContaining(['blue:aeromancer', 'blue:electromancer', 'blue:illusionist']));
  await expect(page.getByTestId('action-presentation')).toHaveAttribute('data-replaying', 'false');
  const after = await exported(page); expect(after).toEqual(before);
  await replay.click(); await page.getByRole('button', { name: 'Torna alla partita', exact: true }).click();
  await expect(cell(page, 'E9')).toHaveAttribute('data-wizard-id', 'blue:aeromancer');
  expect(await exported(page)).toEqual(before);
});

test('annullare elimina le azioni dal replay e saltare il passo extra passa il turno', async ({ page }) => {
  const m = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); m.game.turn = 2; await open(page, m);
  await move(page, 'red:aeromancer', 'F2'); await move(page, 'red:pyromancer', 'D2');
  await page.getByRole('button', { name: 'Annulla attivazione', exact: true }).click();
  await page.getByRole('button', { name: 'Salta attivazione', exact: true }).click();
  await page.getByRole('button', { name: 'Salta passo extra', exact: true }).click();
  const next = await exported(page); expect(next.game.active).toBe('blue'); expect(next.replays?.red?.entries).toHaveLength(1);
  expect(next.replays?.red?.entries[0].activation.wizardId).toBe('red:aeromancer');
});

test('la conferma di un colpo decisivo conclude la partita senza conferme duplicate', async ({ page }) => {
  const m = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); m.game.turn = 2;
  wizard(m.game, 'red:spellsword')!.pos = { x: 4, y: 4 }; wizard(m.game, 'blue:spellsword')!.pos = { x: 5, y: 4 }; wizard(m.game, 'blue:spellsword')!.hp = 2;
  m.game.wizards = m.game.wizards.filter(w => w.side === 'red' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
  await open(page, m); await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click(); await cell(page, 'F6').click();
  await expect(confirm(page)).toHaveText('Conferma e concludi partita'); await confirm(page).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.locator('#result-title')).toContainText('Gilda Rossa');
});

test('senza un passo extra legale la seconda conferma annuncia e passa la mano', async ({ page }) => {
  const m = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); m.game.turn = 2;
  for (const w of m.game.wizards) if (w.side === 'red' && !['aeromancer', 'pyromancer'].includes(w.kind)) w.restrainedUntil = 2;
  await open(page, m); await move(page, 'red:aeromancer', 'F2');
  await page.locator('[data-wizard-id="red:pyromancer"]').click(); await cell(page, 'D2').click();
  await expect(confirm(page)).toHaveText('Conferma e passa turno'); await confirm(page).click();
  await expect(page.locator('.game-heading h1')).toContainText('Gilda Blu');
});

test('mobile: board leggibile, comandi raggiungibili e nessuno scorrimento orizzontale', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('./'); await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  const board = await page.locator('.board-grid').boundingBox(), dock = await page.locator('.action-dock').boundingBox();
  expect(board!.width).toBeGreaterThan(270); expect(dock!.y + dock!.height).toBeLessThanOrEqual(844);
  expect(board!.y + board!.height).toBeLessThanOrEqual(dock!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(confirm(page)).toBeInViewport(); await page.screenshot({ path: 'test-results/ergonomic-mobile.png' });
});
