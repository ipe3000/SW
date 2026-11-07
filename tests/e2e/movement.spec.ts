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
  await open(page, match); await cell(page, 'E6').click(); await page.getByLabel('Modifica percorso passo per passo').check();
  await cell(page, 'F6').click(); await cell(page, 'F5').click(); await page.getByRole('button', { name: 'Conferma attivazione' }).click();
  await advance(page); await page.getByRole('button', { name: 'Pausa sequenza', exact: true }).click();
  await expect(mover(page)).toHaveAttribute('data-moving-piece', 'red:spellsword');
  await expect(mover(page)).toHaveAttribute('data-motion-state', 'paused');
  await expect(page.getByRole('button', { name: 'Prossimo evento' })).toBeDisabled();
  await midpoint(page);
  await expect(cell(page, 'F6').locator('.mage-abbr')).toHaveText('GEO');
  await expect(page.locator('[data-trail-square="E6"]')).toHaveAttribute('data-trail-steps', '0');
  await expect(page.locator('[data-trail-square="F5"]')).toHaveAttribute('data-trail-steps', '2');
  await page.screenshot({ path: 'test-results/movement-mid-step.png', fullPage: true });
  await page.getByRole('button', { name: 'Ruota la scacchiera' }).click(); await midpoint(page);
  await page.getByRole('button', { name: 'Riprendi sequenza', exact: true }).click(); await advance(page);
  await expect(mover(page)).toHaveAttribute('data-from', 'F6'); await expect(mover(page)).toHaveAttribute('data-to', 'F5');
  await advance(page); await page.getByRole('button', { name: 'Mostra esito' }).click();
  await expect(mover(page)).toHaveCount(0); await expect(cell(page, 'F5').locator('.mage-abbr')).toHaveText('SPA');
  await expect(cell(page, 'F6').locator('.mage-abbr')).toHaveText('GEO');
  await expect(page.locator('.movement-trails')).toBeVisible();
  await page.getByRole('button', { name: 'Annulla attivazione', exact: true }).click();
  await expect(page.locator('.movement-trails')).toHaveCount(0); await expect(cell(page, 'E6').locator('.mage-abbr')).toHaveText('SPA');
});

test('la copia scorre su tutte le caselle, resta distinguibile dal proprietario e si vede l’intero tragitto', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'illusionist', 4, 4); put(match, 'red', 'geomancer', 5, 4); put(match, 'blue', 'spellsword', 6, 3);
  match.game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 5, y: 3 } }];
  await open(page, match); await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click();
  await cell(page, 'G6').click(); await page.getByRole('button', { name: 'Concludi abilità' }).click();
  await page.getByRole('button', { name: 'Conferma attivazione' }).click();
  await advance(page); await advance(page);
  await expect(mover(page)).toHaveAttribute('data-moving-piece', 'copy:red:illusionist');
  await expect(mover(page).locator('.illusion-token')).toBeVisible();
  await expect(cell(page, 'E6').locator('.mage-abbr')).toHaveText('ILL');
  await expect(mover(page)).toHaveAttribute('data-to', 'F6');
  await expect(cell(page, 'F6').locator('.mage-abbr')).toHaveText('GEO');
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
  await page.getByRole('button', { name: 'Concludi abilità' }).click(); await page.getByRole('button', { name: 'Conferma attivazione' }).click();
  await advance(page); await advance(page); await expect(mover(page)).toHaveAttribute('data-moving-piece', 'red:geomancer');
  await expect(mover(page)).toHaveAttribute('data-to', 'F5'); await advance(page); await expect(mover(page)).toHaveAttribute('data-to', 'G5');
  await page.getByRole('button', { name: 'Mostra esito' }).click();
  await page.getByRole('button', { name: 'Le mie partite' }).click();
  const tele = scenario(); put(tele, 'red', 'teleporter', 4, 4); put(tele, 'blue', 'spellsword', 2, 4);
  await open(page, tele); await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click(); await cell(page, 'C6').click(); await cell(page, 'G6').click();
  await page.getByRole('button', { name: 'Conferma attivazione' }).click(); await advance(page); await advance(page);
  await expect(page.getByTestId('action-presentation')).toContainText('senza percorso intermedio'); await expect(mover(page)).toHaveCount(0); await expect(page.locator('.movement-trails')).toHaveCount(0);
});

test('con movimento ridotto la sequenza visita comunque ogni casella e non resta bloccata', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const match = scenario(); put(match, 'red', 'spellsword', 4, 4);
  await open(page, match); await cell(page, 'E6').click(); await cell(page, 'G6').click(); await page.getByRole('button', { name: 'Conferma attivazione' }).click();
  await advance(page); await expect(mover(page)).toHaveAttribute('data-to', 'F6'); await expect(mover(page)).toHaveAttribute('data-motion-state', 'arrived');
  await advance(page); await expect(mover(page)).toHaveAttribute('data-to', 'G6'); await advance(page); await page.getByRole('button', { name: 'Mostra esito' }).click();
  await expect(cell(page, 'G6').locator('.mage-abbr')).toHaveText('SPA');
});

test('cambiare velocità durante un passo in pausa mantiene pedina e punto raggiunto', async ({ page }) => {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  match.computer = { side: 'both', profile: 'didactic-v1', speed: 'normal' };
  await open(page, match); await expect(page.getByTestId('action-presentation')).toHaveAttribute('data-playing', 'true', { timeout: 10000 });
  await advance(page); await page.getByRole('button', { name: 'Pausa sequenza', exact: true }).click(); await midpoint(page);
  const id = await mover(page).getAttribute('data-motion-id');
  const before = await mover(page).evaluate(el => Number(el.getAnimations()[0].currentTime));
  await page.getByRole('combobox', { name: 'Velocità dei computer' }).selectOption('slowest');
  await expect(page.getByRole('combobox', { name: 'Velocità dei computer' })).toBeEnabled();
  await expect(mover(page)).toHaveAttribute('data-motion-id', id!); await expect(mover(page)).toHaveAttribute('data-motion-state', 'paused');
  const after = await mover(page).evaluate(async el => { const animation = el.getAnimations()[0]; await animation.ready; return { time: Number(animation.currentTime), rate: animation.playbackRate }; });
  expect(Math.abs(after.time - before)).toBeLessThan(2); expect(after.rate).toBeLessThan(1);
  await expect(page.getByRole('button', { name: 'Prossimo evento' })).toBeDisabled();
  await page.getByRole('button', { name: 'Riprendi sequenza', exact: true }).click(); await expect(mover(page)).toHaveAttribute('data-motion-state', 'arrived');
  await page.getByRole('button', { name: 'Mostra esito' }).click(); await expect(mover(page)).toHaveCount(0);
});
