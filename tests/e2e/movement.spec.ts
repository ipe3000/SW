import { settings, matchMenu } from './ui';
import { test, expect, type Page } from '@playwright/test';
import { newMatch, defaultOptions, wizard, type Match, type Kind, type Side } from '../../src/engine/game';

const cell = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);
const mover = (page: Page) => page.locator('[data-moving-piece]');
function scenario() { const m = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); m.game.turn = 2; return m; }
function put(m: Match, side: Side, kind: Kind, x: number, y: number) { wizard(m.game, `${side}:${kind}`)!.pos = { x, y }; }
async function open(page: Page, match: Match) {
  await page.goto('./'); await page.evaluate(() => localStorage.setItem('sw-presentation-mode', 'manual'));
  await page.getByTestId('import-game').setInputFiles({ name: 'movement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(match)) });
}
async function advance(page: Page) { await page.getByRole('button', { name: 'Prossimo evento' }).click(); }

test('gli aiuti manuali seguono i passi residui e consentono di attraversare un alleato', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'spellsword', 4, 4); put(match, 'red', 'geomancer', 5, 4);
  await open(page, match); await cell(page, 'E6').click(); await settings(page); await page.getByLabel('Modifica percorso passo per passo').check();
  await expect(cell(page, 'F6')).toHaveClass(/reachable/);
  await expect(cell(page, 'G6')).not.toHaveClass(/reachable/);
  await cell(page, 'G6').click(); await expect(page.locator('.action-dock [role="alert"]')).toContainText('una casella ortogonale');
  for (const square of ['F6', 'G6', 'G5', 'F5']) {
    await expect(cell(page, square)).toHaveClass(/reachable/);
    await cell(page, square).click();
  }
  await expect(page.locator('.cell.reachable')).toHaveCount(0);
  await expect(page.locator('.draft-budget')).toContainText('Passi 4/4');
  await expect(page.locator('.confirm-activation')).toBeEnabled();
});

test('il percorso manuale della copia evidenzia solo il prossimo passo o un colpo valido', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'illusionist', 4, 4); put(match, 'red', 'geomancer', 5, 4); put(match, 'blue', 'spellsword', 6, 6);
  match.game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 5, y: 3 } }];
  await open(page, match); await settings(page); await page.getByLabel('Modifica percorso passo per passo').check();
  await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click();
  await expect(cell(page, 'F6')).toHaveClass(/targetable/);
  await expect(cell(page, 'G6')).not.toHaveClass(/targetable/);
  await cell(page, 'G6').click(); await expect(page.locator('.action-dock [role="alert"]')).toContainText('una casella ortogonale');
  for (const square of ['F6', 'G6', 'G5']) { await expect(cell(page, square)).toHaveClass(/targetable/); await cell(page, square).click(); }
  await expect(page.locator('.cell.targetable')).toHaveCount(1);
  await expect(cell(page, 'G4')).toHaveClass(/targetable/); await cell(page, 'G4').click();
  await page.getByRole('button', { name: 'Concludi abilità', exact: true }).click();
  await expect(page.locator('.confirm-activation')).toBeEnabled();
  await expect(cell(page, 'G4')).toHaveAttribute('aria-label', /3 punti vita/);
});
async function midpoint(page: Page) {
  await mover(page).evaluate(el => { const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = Number(animation.effect!.getTiming().duration) / 2; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  const motion = mover(page), a = await motion.getAttribute('data-from'), b = await motion.getAttribute('data-to');
  const [from, to, moving] = await Promise.all([cell(page, a!).boundingBox(), cell(page, b!).boundingBox(), motion.boundingBox()]);
  expect(Math.abs(moving!.x - (from!.x + to!.x) / 2)).toBeLessThan(1.5);
  expect(Math.abs(moving!.y - (from!.y + to!.y) / 2)).toBeLessThan(1.5);
}

test('il mago scorre lungo un percorso con svolta e attraversa un alleato senza nasconderlo', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'spellsword', 4, 4); put(match, 'red', 'geomancer', 5, 4);
  await open(page, match); await cell(page, 'E6').click(); await settings(page); await page.getByLabel('Modifica percorso passo per passo').check();
  await cell(page, 'F6').click(); await cell(page, 'F5').click(); await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click();
  await advance(page); await page.getByRole('button', { name: 'Pausa sequenza', exact: true }).click();
  await expect(mover(page)).toHaveAttribute('data-moving-piece', 'red:spellsword');
  await expect(mover(page)).toHaveAttribute('data-motion-state', 'paused');
  await expect(page.getByRole('button', { name: 'Prossimo evento' })).toBeDisabled();
  await midpoint(page);
  await expect(cell(page, 'F6').locator('[data-emblem="geomancer"]')).toBeVisible();
  await expect(page.locator('[data-trail-square="E6"]')).toHaveAttribute('data-trail-steps', '0');
  await expect(page.locator('[data-trail-square="F5"]')).toHaveAttribute('data-trail-steps', '2');
  await page.screenshot({ path: 'test-results/movement-mid-step.png', fullPage: true });
  await page.getByRole('button', { name: 'Ruota la scacchiera' }).click(); await midpoint(page);
  await page.getByRole('button', { name: 'Riprendi sequenza', exact: true }).click(); await advance(page);
  await expect(mover(page)).toHaveAttribute('data-from', 'F6'); await expect(mover(page)).toHaveAttribute('data-to', 'F5');
  await advance(page); await page.getByRole('button', { name: 'Mostra esito' }).click();
  await expect(mover(page)).toHaveCount(0); await expect(cell(page, 'F5').locator('[data-emblem="spellsword"]')).toBeVisible();
  await expect(cell(page, 'F6').locator('[data-emblem="geomancer"]')).toBeVisible();
  await expect(page.locator('.movement-trails')).toBeVisible();
  await page.getByRole('button', { name: 'Annulla attivazione', exact: true }).click();
  await expect(page.locator('.movement-trails')).toHaveCount(0); await expect(cell(page, 'E6').locator('[data-emblem="spellsword"]')).toBeVisible();
});

test('la copia scorre su tutte le caselle, resta distinguibile dal proprietario e si vede l’intero tragitto', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'illusionist', 4, 4); put(match, 'red', 'geomancer', 5, 4); put(match, 'blue', 'spellsword', 6, 3);
  match.game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 5, y: 3 } }];
  await open(page, match); await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click();
  await cell(page, 'G6').click(); await page.getByRole('button', { name: 'Concludi abilità' }).click();
  await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click();
  await advance(page); await advance(page);
  await expect(mover(page)).toHaveAttribute('data-moving-piece', 'copy:red:illusionist');
  await expect(mover(page).locator('.illusion-token')).toBeVisible();
  const alignment = await mover(page).locator('.illusion-token').evaluate(el => { const box = el.getBoundingClientRect(), eye = el.querySelector('[data-emblem]')!.getBoundingClientRect(); return [eye.x + eye.width/2 - box.x - box.width/2, eye.y + eye.height/2 - box.y - box.height/2]; });
  for (const difference of alignment) expect(Math.abs(difference)).toBeLessThan(.5);
  await expect(cell(page, 'E6').locator('[data-emblem="illusionist"]')).toBeVisible();
  await expect(mover(page)).toHaveAttribute('data-to', 'F6');
  await expect(cell(page, 'F6').locator('[data-emblem="geomancer"]')).toBeVisible();
  const steps = new Set<string>();
  for (let i = 0; i < 2; i++) { steps.add((await mover(page).getAttribute('data-to'))!); await advance(page); }
  expect(steps.has('G6')).toBe(true);
  await page.getByRole('button', { name: 'Mostra esito' }).click();
  await expect(cell(page, 'G6').locator('.illusion-token')).toBeVisible();
  await expect(page.locator('.copy-trail [data-trail-steps="2"]')).toHaveAttribute('data-trail-square', 'G6');
});

test('il vento muove il bersaglio passo per passo; il teletrasporto non percorre caselle intermedie', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'aeromancer', 4, 4); put(match, 'red', 'geomancer', 5, 4);
  await open(page, match); await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click();
  await cell(page, 'F6').click(); await cell(page, 'F5').click(); await cell(page, 'G5').click();
  await page.getByRole('button', { name: 'Concludi abilità' }).click(); await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click();
  await advance(page); await page.screenshot({ path: 'test-results/battle-wind.png', fullPage: true }); await advance(page); await expect(mover(page)).toHaveAttribute('data-moving-piece', 'red:geomancer');
  await expect(mover(page)).toHaveAttribute('data-to', 'F5'); await advance(page); await expect(mover(page)).toHaveAttribute('data-to', 'G5');
  await page.getByRole('button', { name: 'Mostra esito' }).click();
  await matchMenu(page); await page.getByRole('button', { name: 'Le mie partite' }).click(); await page.getByRole('button', { name: 'Esci e torna all’inizio' }).click();
  const tele = scenario(); put(tele, 'red', 'teleporter', 4, 4); put(tele, 'blue', 'spellsword', 2, 4);
  await open(page, tele); await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click(); await cell(page, 'C6').click(); await cell(page, 'G6').click();
  await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click(); await advance(page); await advance(page);
  await expect(page.getByTestId('action-presentation')).toContainText('senza percorso intermedio'); await expect(mover(page)).toHaveCount(0); await expect(page.locator('.movement-trails')).toHaveCount(0);
});

test('con movimento ridotto la sequenza visita comunque ogni casella e non resta bloccata', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const match = scenario(); put(match, 'red', 'spellsword', 4, 4);
  await open(page, match); await cell(page, 'E6').click(); await cell(page, 'G6').click(); await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click();
  await advance(page); await expect(mover(page)).toHaveAttribute('data-to', 'F6'); await expect(mover(page)).toHaveAttribute('data-motion-state', 'arrived');
  await advance(page); await expect(mover(page)).toHaveAttribute('data-to', 'G6'); await advance(page); await page.getByRole('button', { name: 'Mostra esito' }).click();
  await expect(cell(page, 'G6').locator('[data-emblem="spellsword"]')).toBeVisible();
});

test('cambiare velocità durante un passo in pausa mantiene pedina e punto raggiunto', async ({ page }) => {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  match.computer = { side: 'both', profile: 'didactic-v1', speed: 'normal' };
  await open(page, match); await expect(page.getByTestId('action-presentation')).toHaveAttribute('data-playing', 'true', { timeout: 10000 });
  await advance(page); await page.getByRole('button', { name: 'Pausa duello', exact: true }).click(); await midpoint(page);
  const id = await mover(page).getAttribute('data-motion-id');
  const before = await mover(page).evaluate(el => Number(el.getAnimations()[0].currentTime));
  await settings(page); await page.getByRole('combobox', { name: 'Velocità dei computer' }).selectOption('slowest');
  await expect(page.getByRole('combobox', { name: 'Velocità dei computer' })).toBeEnabled();
  await expect(mover(page)).toHaveAttribute('data-motion-id', id!); await expect(mover(page)).toHaveAttribute('data-motion-state', 'paused');
  const after = await mover(page).evaluate(async el => { const animation = el.getAnimations()[0]; await animation.ready; return { time: Number(animation.currentTime), rate: animation.playbackRate }; });
  expect(Math.abs(after.time - before)).toBeLessThan(2); expect(after.rate).toBeLessThan(1);
  await expect(page.getByRole('button', { name: 'Prossimo evento' })).toBeDisabled();
  await page.getByRole('button', { name: 'Riprendi duello', exact: true }).click(); await expect(mover(page)).toHaveAttribute('data-motion-state', 'arrived');
  await page.getByRole('button', { name: 'Mostra esito' }).click(); await expect(mover(page)).toHaveCount(0);
});
