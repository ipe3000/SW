import { settings, matchMenu, setupOptions } from './ui';
import { test, expect, type Page } from '@playwright/test';
import { defaultOptions, newMatch, wizard, type Kind, type Match, type Side } from '../../src/engine/game';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('sw-presentation-mode', 'instant')); });

const cell = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);
const mage = (page: Page, side: Side, kind: Kind) => page.locator(`[data-wizard-id="${side}:${kind}"]`);
function scenario() { const value = newMatch({ hp: 4, walls: 'varied', placement: 'standard', redName: 'Gilda Rossa', blueName: 'Gilda Blu' }, () => .8); value.game.turn = 2; return value; }
function put(value: Match, side: Side, kind: Kind, x: number, y: number, hp = 4) { const w = wizard(value.game, `${side}:${kind}`)!; w.pos = { x, y }; w.hp = hp; return w; }
async function open(page: Page, value: Match) { await page.goto('./'); await page.getByTestId('import-game').setInputFiles({ name: 'scenario.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) }); await expect(page.getByRole('heading', { name: 'Il turno di Gilda Rossa.' })).toBeVisible(); }
async function cast(page: Page, kind: Kind, target?: string) { await mage(page, 'red', kind).click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click(); if (target) await cell(page, target).click(); }
async function confirm(page: Page) { await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click(); }

test('scacchiera regolare, sedici maghi, primo turno, annullamento e ripresa', async ({ page }) => {
  await page.goto('./'); await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  await expect(page.locator('[data-wizard-id]')).toHaveCount(16);
  await expect(page.locator('.force-wall')).toHaveCount(2);
  const geometry = await page.locator('.board-grid').evaluate(board => {
    const cells = [...board.querySelectorAll('button')].map(c => c.getBoundingClientRect());
    return { heights: cells.map(c => c.height), widths: cells.map(c => c.width), gaps: cells.slice(10).map((c, i) => c.top - cells[i].bottom) };
  });
  expect(Math.max(...geometry.heights) - Math.min(...geometry.heights)).toBeLessThan(.1);
  expect(Math.max(...geometry.widths) - Math.min(...geometry.widths)).toBeLessThan(.1);
  expect(Math.max(...geometry.gaps.map(Math.abs))).toBeLessThan(.1);
  await page.screenshot({ path: 'test-results/game-initial.png', fullPage: true });
  await mage(page, 'red', 'aeromancer').click(); await cell(page, 'F3').click();
  await expect(cell(page, 'F3')).toHaveAttribute('data-wizard-id', 'red:aeromancer');
  await page.getByRole('button', { name: 'Azzera preparazione' }).click();
  await expect(cell(page, 'F1')).toHaveAttribute('data-wizard-id', 'red:aeromancer');
  await mage(page, 'red', 'aeromancer').click(); await cell(page, 'F2').click(); await confirm(page);
  await page.reload(); await expect(cell(page, 'F2')).toHaveAttribute('data-wizard-id', 'red:aeromancer');
  await expect(page.getByRole('heading', { name: 'Il turno di Gilda Blu.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Annulla attivazione', exact: true })).toBeDisabled();
  await expect(cell(page, 'B10')).toHaveAttribute('data-wizard-id', 'blue:spellsword');
  await page.getByRole('button', { name: 'Ruota la scacchiera' }).click();
  await expect(page.locator('.board-grid button').first()).toHaveAttribute('data-square', 'J1');
});

test('schieramento personalizzato, varianti e obbligo di attività', async ({ page }) => {
  await page.goto('./'); await setupOptions(page); await page.getByRole('combobox', { name: 'Punti vita iniziali' }).selectOption('3'); await setupOptions(page); await page.getByRole('combobox', { name: 'Schieramento', exact: true }).selectOption('custom'); await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  const batches: [Side, number][] = [['red', 4], ['blue', 6], ['red', 2], ['blue', 2], ['red', 2]];
  const placed = { red: 0, blue: 0 };
  for (const [side, quantity] of batches) for (let i = 0; i < quantity; i++) {
    await page.getByRole('button', { name: /^Schiera / }).first().click();
    await cell(page, `${String.fromCharCode(66 + placed[side]++)}${side === 'red' ? 1 : 10}`).click();
  }
  await expect(page.locator('[data-wizard-id]')).toHaveCount(16);
  await expect(page.locator('.board-grid .mage-hp').first()).toHaveText('3');
  await expect(page.getByRole('button', { name: 'Termina turno', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Salta attivazione' })).toBeDisabled();
});

test('Lamarcana: movimento prima e dopo il colpo, anteprima e backup', async ({ page }) => {
  const value = scenario(); put(value, 'red', 'spellsword', 4, 4); put(value, 'blue', 'geomancer', 5, 3);
  await open(page, value); await mage(page, 'red', 'spellsword').click(); await cell(page, 'E7').click();
  await page.getByRole('button', { name: 'Usa abilità', exact: true }).click(); await cell(page, 'F7').click();
  await expect(mage(page, 'blue', 'geomancer').locator('.mage-hp')).toHaveText('2');
  await cell(page, 'E6').click(); await confirm(page);
  await expect(cell(page, 'E6')).toHaveAttribute('data-wizard-id', 'red:spellsword');
  await expect(page.getByRole('heading', { name: '2° Attivazione', exact: true })).toBeVisible();
  const download = page.waitForEvent('download'); await matchMenu(page); await page.getByRole('button', { name: 'Esporta partita' }).click(); expect((await download).suggestedFilename()).toMatch(/strategic-wizardry-/);
});

test('Aeromante: scelta guidata, spostamento alleato e divieto di andata e ritorno', async ({ page }) => {
  const value = scenario(); put(value, 'red', 'aeromancer', 4, 4); put(value, 'red', 'geomancer', 5, 4);
  await open(page, value); await cast(page, 'aeromancer', 'F6');
  await page.getByRole('button', { name: 'Concludi abilità' }).click(); await expect(page.getByRole('alert').last()).toContainText('senza effetti');
  await cell(page, 'F5').click(); await cell(page, 'F6').click();
  await page.getByRole('button', { name: 'Concludi abilità' }).click(); await expect(page.getByRole('alert').last()).toContainText('senza effetti');
  await page.getByRole('button', { name: 'Annulla ultimo passo' }).click();
  await page.getByRole('button', { name: 'Concludi abilità' }).click(); await confirm(page);
  await expect(cell(page, 'F5')).toHaveAttribute('data-wizard-id', 'red:geomancer');
  await expect(mage(page, 'red', 'geomancer').locator('.mage-hp')).toHaveText('4');
});

test('Teletrasportatore: selezione bersaglio e destinazione misurata dal lanciatore', async ({ page }) => {
  const value = scenario(); put(value, 'red', 'teleporter', 4, 5); put(value, 'blue', 'spellsword', 2, 4);
  await open(page, value); await mage(page, 'red', 'teleporter').click(); await cell(page, 'E6').click();
  await page.getByRole('button', { name: 'Usa abilità', exact: true }).click(); await cell(page, 'C6').click();
  await expect(cell(page, 'E6')).toHaveAttribute('data-wizard-id', 'red:teleporter');
  await cell(page, 'G6').click(); await confirm(page);
  await expect(cell(page, 'G6')).toHaveAttribute('data-wizard-id', 'blue:spellsword');
});

test('percorso modificabile attraverso un alleato e interfaccia su schermo stretto', async ({ page }) => {
  const value = scenario(); put(value, 'red', 'spellsword', 4, 4); put(value, 'red', 'geomancer', 5, 4);
  await open(page, value); await mage(page, 'red', 'spellsword').click();
  await settings(page); await page.getByLabel('Modifica percorso passo per passo').check();
  await cell(page, 'F6').click(); await expect(page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ })).toBeDisabled();
  await cell(page, 'G6').click(); await confirm(page);
  await expect(cell(page, 'G6')).toHaveAttribute('data-wizard-id', 'red:spellsword');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/game-mobile.png', fullPage: true });
});

test('Illusionista: evocazione, comando, danno e annullamento', async ({ page }) => {
  const value = scenario(); put(value, 'red', 'illusionist', 4, 4); put(value, 'blue', 'spellsword', 6, 6);
  await open(page, value); await cast(page, 'illusionist'); await cell(page, 'F6').click(); await cell(page, 'G5').click(); await cell(page, 'G4').click();
  await page.getByRole('button', { name: 'Concludi abilità' }).click(); await confirm(page);
  await expect(cell(page, 'G5').locator('.illusion-token')).toBeVisible();
  await expect(mage(page, 'blue', 'spellsword').locator('.mage-hp')).toHaveText('3');
  await page.getByRole('button', { name: 'Annulla attivazione', exact: true }).click();
  await expect(page.locator('.board-grid .illusion-token')).toHaveCount(0);
  await expect(mage(page, 'blue', 'spellsword').locator('.mage-hp')).toHaveText('4');
});

test('Elettromante e Geomante: scarica sugli alleati e immobilizzazione', async ({ page }) => {
  const value = scenario(); put(value, 'red', 'electromancer', 4, 4); put(value, 'red', 'geomancer', 5, 4); put(value, 'blue', 'spellsword', 6, 4);
  await open(page, value); await cast(page, 'electromancer'); await confirm(page);
  await expect(mage(page, 'red', 'geomancer').locator('.mage-hp')).toHaveText('3');
  await expect(mage(page, 'blue', 'spellsword').locator('.mage-hp')).toHaveText('3');
  await cast(page, 'geomancer', 'G6'); await confirm(page);
  await expect(mage(page, 'blue', 'spellsword').locator('.earth-prison')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Passo extra', exact: true })).toBeVisible();
  await mage(page, 'red', 'aeromancer').click(); await expect(page.getByRole('button', { name: 'Usa abilità', exact: true })).toBeDisabled();
});

test('Incantatore: passiva a inizio attivazione e tocco psichico', async ({ page }) => {
  const value = scenario(); put(value, 'red', 'enchanter', 4, 4); put(value, 'blue', 'spellsword', 5, 4); put(value, 'red', 'aeromancer', 4, 6); put(value, 'blue', 'enchanter', 4, 5);
  await open(page, value); await mage(page, 'red', 'aeromancer').click(); await cell(page, 'F4').click();
  await expect(page.getByRole('button', { name: 'Usa abilità', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Azzera preparazione' }).click();
  // The red Enchanter also starts charmed in this position: move the opposing Enchanter away in a fresh game.
  value.game.id = crypto.randomUUID(); put(value, 'blue', 'enchanter', 0, 0);
  await matchMenu(page); await page.getByRole('button', { name: 'Le mie partite' }).click(); await open(page, value);
  await cast(page, 'enchanter', 'F6'); await confirm(page);
  await expect(mage(page, 'blue', 'spellsword').locator('.mage-hp')).toHaveText('3');
});

test('Piromante: anteprima annullabile e vittoria definitiva alla conferma', async ({ page }) => {
  const value = scenario(); put(value, 'red', 'pyromancer', 4, 4); put(value, 'blue', 'spellsword', 5, 4, 1);
  value.game.wizards = value.game.wizards.filter(w => w.side === 'red' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
  await open(page, value); await cast(page, 'pyromancer', 'E6');
  await expect(page.locator('.confirm-activation')).toHaveText('Conferma e concludi partita');
  await page.getByRole('button', { name: 'Azzera preparazione' }).click();
  await expect(mage(page, 'blue', 'spellsword')).toBeVisible();
  await cast(page, 'pyromancer', 'E6'); await confirm(page);
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('dialog')).toContainText('tre maghi o meno');
  await page.screenshot({ path: 'test-results/duel-result-dialog.png', fullPage: true }); await page.getByRole('button', { name: 'Osserva il campo' }).click();
  await expect(page.getByRole('heading', { name: 'Vittoria Gilda Rossa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Annulla attivazione', exact: true })).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Vittoria Gilda Rossa' })).toBeVisible();
});

test('confermare la semiattivazione passa il turno senza un secondo comando', async ({ page }) => {
  const value = newMatch(defaultOptions); value.game.turn = 2; value.game.phase = 2; value.game.activity = true;
  value.game.activated = ['red:geomancer', 'red:pyromancer'];
  await open(page, value); await page.locator('[data-square="G1"]').click(); await page.locator('[data-square="G2"]').click();
  await expect(page.locator('.semi-turn-note')).toContainText('non saranno più annullabili');
  await page.getByRole('button', { name: 'Conferma e passa turno' }).click();
  await expect(page.getByRole('heading', { name: 'Il turno di Gilda Blu.' })).toBeVisible();
  await expect(page.locator('[data-square="G2"] [data-emblem=\"illusionist\"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Annulla attivazione', exact: true })).toBeDisabled();
});
