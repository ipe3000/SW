import { matchMenu, closeMenu } from './ui';
import { test, expect, type Page } from '@playwright/test';
import { newMatch, defaultOptions, wizard, type Match } from '../../src/engine/game';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('sw-presentation-mode', 'instant')); });
const cell = (page: Page, square: string) => page.locator(`[data-square="${square}"]`);
const confirm = (page: Page) => page.locator('.confirm-activation');
async function move(page: Page, id: string, square: string) { await page.locator(`[data-wizard-id="${id}"]`).click(); await cell(page, square).click(); await expect(confirm(page)).toBeEnabled(); await confirm(page).click(); }
const menu = matchMenu;
async function exported(page: Page) { await menu(page, 'Partita'); const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Esporta partita', exact: true }).click(); const value = JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as Match; await closeMenu(page); return value; }
async function open(page: Page, match: Match) { await page.goto('./'); await page.getByTestId('import-game').setInputFiles({ name: 'ergonomics.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(match)) }); }
async function completedEnemyTurn(page: Page) {
  await page.goto('./'); await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  await move(page, 'red:aeromancer', 'F2');
  await expect(page.locator('.turn-status.blue')).toContainText('Il turno di Gilda Blu.');
  await expect(page.locator('.current-turn-phase')).toHaveText('1° Attivazione');
  await move(page, 'blue:aeromancer', 'E9');
  await expect(page.locator('.current-turn-phase')).toHaveText('2° Attivazione');
  await expect(page.locator('.phase-track [aria-current="step"]')).toHaveText('2° Attivazione');
  await move(page, 'blue:electromancer', 'I9');
  await expect(page.locator('.current-turn-phase')).toHaveText('Passo extra');
  await expect(page.locator('.phase-track [aria-current="step"]')).toHaveText('Passo extra');
  await move(page, 'blue:illusionist', 'D9');
  await expect(page.locator('.game-heading h1')).toHaveText('Il turno di Gilda Rossa.');
  await expect(page.locator('.game-heading:has(.turn-status.red) .current-turn-phase')).toHaveText('1° Attivazione');
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
  await menu(page, 'Impostazioni'); await expect(page.getByRole('button', { name: 'Attiva suoni' })).toBeVisible(); await closeMenu(page);
  expect(await confirm(page).boundingBox()).toEqual(after);
  await page.screenshot({ path: 'test-results/ergonomic-desktop.png' });
});

test('prima conferma passa la mano e il passo extra conclude senza un secondo comando', async ({ page }) => {
  await completedEnemyTurn(page);
  const state = await exported(page);
  expect(state.revision).toBe(4); expect(state.game.turn).toBe(2); expect(state.undo).toEqual([]);
  expect(state.replays?.red?.entries).toHaveLength(1); expect(state.replays?.blue?.entries).toHaveLength(3);
  await expect(page.getByRole('button', { name: 'Annulla attivazione', exact: true })).toHaveCount(0);
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
  await open(page, m); await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Prepara abilità', exact: true }).click(); await cell(page, 'F6').click();
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

test('desktop: nessuna coda sotto il gioco e contenuti raggiungibili anche con finestre basse', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const m = newMatch({ ...defaultOptions, walls: 'varied', redName: 'Un nome molto lungo per il giocatore Rosso' }, () => .8); m.game.turn = 2;
  await open(page, m); await page.locator('[data-wizard-id="red:illusionist"]').click();
  await menu(page); await closeMenu(page);
  for (const [width, height] of [[1366, 768], [1280, 720], [1024, 480], [800, 400]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo(0, 10000));
    expect(await page.evaluate(() => ({ scroll: scrollY, excess: document.documentElement.scrollHeight - innerHeight }))).toEqual({ scroll: 0, excess: 0 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const board = await page.locator('.board-grid').boundingBox(), dock = await page.locator('.action-dock').boundingBox();
    expect(board!.y).toBeGreaterThanOrEqual(0); expect(board!.y + board!.height).toBeLessThanOrEqual(height);
    expect(dock!.y + dock!.height).toBeLessThanOrEqual(height);
    await menu(page, 'Partita'); await page.getByRole('button', { name: 'Esporta partita', exact: true }).scrollIntoViewIfNeeded(); await expect(page.getByRole('button', { name: 'Esporta partita', exact: true })).toBeInViewport(); await closeMenu(page);
    await confirm(page).scrollIntoViewIfNeeded(); await expect(confirm(page)).toBeInViewport();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.screenshot({ path: `test-results/contained-desktop-${height}.png` });
  }
  await expect(page.locator('footer')).toHaveCount(0);
  await menu(page); await page.getByRole('button', { name: 'Torna alla pagina iniziale' }).click(); await page.getByRole('button', { name: 'Esci e torna all’inizio' }).click(); await expect(page.locator('.fantasy-entry')).toBeVisible(); await expect(page.locator('footer')).toHaveCount(0);
});

test('mobile: campo e comandi rientrano senza scorrimento o blocchi della pagina', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('./'); await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  for (const [width, height] of [[390, 844], [390, 667], [430, 932]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const dock = await page.locator('.action-dock').boundingBox(); expect(dock!.y + dock!.height).toBeLessThanOrEqual(height);
    expect(await page.locator('.app-shell').evaluate(el => getComputedStyle(el).overflowY)).toBe('visible');
    await menu(page, 'Partita'); await page.getByRole('button', { name: 'Esporta partita', exact: true }).scrollIntoViewIfNeeded(); await expect(page.getByRole('button', { name: 'Esporta partita', exact: true })).toBeInViewport(); await closeMenu(page);
  }
  await page.screenshot({ path: 'test-results/contained-mobile-bottom.png', fullPage: true });
});

for (const mobile of [false, true]) test(`scheda su richiesta ${mobile ? 'mobile' : 'desktop'}: entrambe le gilde, focus e preparazione conservati`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1366, height: 768 });
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); match.game.turn = 2;
  await open(page, match);
  await expect(page.locator('.mage-card')).toHaveCount(0);
  await page.locator('[data-wizard-id="red:aeromancer"]').click(); await cell(page, 'F2').click();
  const board = await page.locator('.board-grid').boundingBox();
  const budget = await page.locator('.draft-budget').innerText();
  expect((await page.locator('.mage-card').boundingBox())!.height).toBeLessThan(100);
  await page.getByRole('button', { name: 'Dettagli', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aeromante', exact: true });
  await expect(dialog).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Chiudi scheda mago' })).toBeFocused();
  await dialog.getByLabel('Mago da consultare').selectOption('blue:geomancer');
  await expect(page.getByRole('dialog', { name: 'Geomante', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByText('Regole complete', { exact: true }).click();
  await page.screenshot({ path: `test-results/mage-details-${mobile ? 'mobile' : 'desktop'}.png` });
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dettagli', exact: true })).toBeFocused();
  await expect(page.locator('.draft-budget')).toHaveText(budget);
  expect(await page.locator('.board-grid').boundingBox()).toEqual(board);
  await expect(cell(page, 'F2')).toHaveAttribute('data-wizard-id', 'red:aeromancer');
  await expect(confirm(page)).toBeEnabled();
  await page.getByRole('button', { name: 'Dettagli', exact: true }).click();
  await page.getByRole('button', { name: 'Chiudi scheda mago' }).click();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('doppio clic prepara il potere, il bersaglio resta un bersaglio e serve confermare', async ({ page }) => {
  const m = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); m.game.turn = 2;
  wizard(m.game, 'red:spellsword')!.pos = { x: 4, y: 4 }; wizard(m.game, 'blue:spellsword')!.pos = { x: 5, y: 4 };
  await open(page, m);
  await cell(page, 'E6').dblclick();
  await expect(page.locator('.dock-instruction')).toHaveText('Scegli il bersaglio evidenziato.');
  await expect(confirm(page)).toBeDisabled();
  await cell(page, 'F6').dblclick();
  await expect(page.locator('.draft-budget')).toContainText('Lamarcana');
  await expect(cell(page, 'F6').locator('.mage-hp')).toHaveText('2');
  await expect(page.locator('.mage-card h3')).toHaveText('Lamarcana');
  await expect(confirm(page)).toBeEnabled();
  expect(await exported(page)).toEqual(m);
  await confirm(page).click();
  const after = await exported(page); expect(after.revision).toBe(m.revision + 1);
  expect(wizard(after.game, 'blue:spellsword')!.hp).toBe(2);
});

test('doppio clic conserva il percorso, non attiva avversari né maghi incantati o nel passo extra', async ({ page }) => {
  const m = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); m.game.turn = 2;
  await open(page, m); await page.locator('[data-wizard-id="red:illusionist"]').click(); await cell(page, 'G2').click();
  await expect(cell(page, 'G2')).toHaveAttribute('data-wizard-id', 'red:illusionist');
  const budget = await page.locator('.draft-budget').innerText();
  await page.locator('[data-wizard-id="blue:illusionist"]').dblclick();
  await expect(page.locator('.draft-budget')).toHaveText(budget);
  await cell(page, 'G2').dblclick();
  await expect(page.locator('.dock-instruction')).toContainText('Scegli dove evocare');
  await expect(page.locator('.draft-budget')).toContainText('Passi 1/');
  for (const condition of ['extra', 'charmed', 'spent'] as const) {
    const state = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); state.game.turn = 2;
    wizard(state.game, 'red:spellsword')!.pos = { x: 4, y: 4 }; wizard(state.game, condition === 'charmed' ? 'blue:enchanter' : 'blue:spellsword')!.pos = { x: 5, y: 4 };
    if (condition === 'extra') state.game.phase = 2;
    if (condition === 'spent') state.game.activated = ['red:spellsword'];
    await page.evaluate(() => sessionStorage.removeItem('sw-local-active'));
    await open(page, state); await cell(page, 'E6').dblclick();
    await expect(page.getByRole('button', { name: 'Prepara abilità', exact: true })).toBeDisabled();
    await expect(page.locator('.dock-instruction')).not.toContainText('Scegli il bersaglio');
    await expect(page.locator('.plan-preview')).toHaveCount(0);
  }
});
