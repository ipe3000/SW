import { settings, matchMenu } from './ui';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { defaultOptions, newMatch, wizard, type Kind, type Match, type Side } from '../../src/engine/game';
import { importMatch } from '../../src/engine/backup';

const cell = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);
const live = (page: Page) => page.getByTestId('action-presentation');
function scenario() { const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); match.game.turn = 2; return match; }
function put(match: Match, side: Side, kind: Kind, x: number, y: number, hp = 4) { const w = wizard(match.game, `${side}:${kind}`)!; w.pos = { x, y }; w.hp = hp; }
async function open(page: Page, match: Match, manual = true) {
  await page.goto('./');
  if (manual) await page.evaluate(() => localStorage.setItem('sw-presentation-mode', 'manual'));
  await page.getByTestId('import-game').setInputFiles({ name: 'presentation.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(match)) });
  await expect(page.locator('.board-grid')).toBeVisible(); await expect(live(page)).toBeAttached(); await settings(page);
}
async function cast(page: Page, kind: Kind, target?: string) {
  await page.locator(`[data-wizard-id="red:${kind}"]`).click();
  await page.getByRole('button', { name: 'Usa abilità', exact: true }).click();
  if (target) await cell(page, target).click();
  await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click();
}
async function next(page: Page, heading: string) { await page.getByRole('button', { name: 'Prossimo evento' }).click(); await expect(live(page).getByRole('heading')).toHaveText(heading); }
async function exported(page: Page) {
  const download = page.waitForEvent('download'); await matchMenu(page); await page.getByRole('button', { name: 'Esporta partita' }).click();
  return importMatch(await readFile((await (await download).path())!, 'utf8'));
}

test('danno, zero PV, eliminazione e copia svanita leggibili prima di rimuovere la pedina; replay e annullamento', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'spellsword', 4, 4); put(match, 'blue', 'illusionist', 5, 4, 1);
  match.game.copies = [{ ownerId: 'blue:illusionist', side: 'blue', pos: { x: 6, y: 4 } }];
  await open(page, match); await cast(page, 'spellsword', 'F6');
  await expect(live(page)).toHaveAttribute('data-playing', 'true');
  await expect(cell(page, 'F6').locator('.mage-hp')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Annulla attivazione', exact: true })).toBeDisabled();
  const saved = await exported(page); expect(wizard(saved.game, 'blue:illusionist')).toBeUndefined();
  await next(page, 'Lamarcana Rosso: Lama arcana'); await next(page, 'Danno');
  await expect(cell(page, 'F6').locator('.mage-hp')).toHaveText('0');
  await expect(page.locator('[data-cue-square="F6"]')).toContainText('1 → 0');
  await expect(page.locator('[data-cue-square="F6"]')).toHaveAttribute('aria-label', /ELIMINATO/);
  await expect(cell(page, 'G6').locator('.illusion-token')).toBeVisible();
  await page.screenshot({ path: 'test-results/presentation-lethal.png', fullPage: true });
  await next(page, 'Eliminazioni e copie svanite');
  await expect(cell(page, 'F6')).not.toHaveAttribute('data-wizard-id');
  await expect(page.locator('[data-cue-square="F6"]')).toHaveAttribute('aria-label', 'ELIMINATO');
  await expect(page.locator('[data-cue-square="G6"]')).toHaveAttribute('aria-label', 'COPIA SVANITA');
  await expect(live(page)).toContainText('perché il suo Illusionista ha subito danni');
  await page.getByRole('button', { name: 'Mostra esito' }).click();
  await expect(live(page)).toContainText('1 → 0');
  expect(await exported(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Annulla attivazione', exact: true }).click();
  await expect(live(page)).toContainText('ripristinati posizioni, punti vita, copie, effetti e risultato');
  await expect(cell(page, 'F6').locator('.mage-hp')).toHaveText('1'); await expect(cell(page, 'G6').locator('.illusion-token')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rivedi ultimo turno avversario' })).toBeDisabled();
});

test('scarica simultanea e immobilizzazione con durata, anche con aiuti disattivati', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'electromancer', 4, 4); put(match, 'red', 'geomancer', 5, 4); put(match, 'blue', 'spellsword', 6, 4);
  await open(page, match); await settings(page); await page.getByLabel('Mostra aiuti e anteprime degli effetti').uncheck();
  await cast(page, 'electromancer'); await next(page, 'Elettromante Rosso: Scarica a catena'); await next(page, 'Danni simultanei');
  await expect(page.locator('.event-cue.damage')).toHaveCount(2);
  await expect(cell(page, 'F6').locator('.mage-hp')).toHaveText('3'); await expect(cell(page, 'G6').locator('.mage-hp')).toHaveText('3');
  await page.getByRole('button', { name: 'Mostra esito' }).click();
  await cast(page, 'geomancer', 'G6'); await next(page, 'Geomante Rosso: Presa della terra'); await next(page, 'Danno'); await next(page, 'Immobilizzazione');
  await expect(cell(page, 'G6').locator('.event-cue.status')).toHaveAttribute('aria-label', 'IMMOBILIZZATO');
  await cell(page, 'G6').click(); await page.getByRole('button', { name: 'Dettagli', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.mage-condition-note')).toContainText('prossimo turno Blu');
  await page.getByRole('button', { name: 'Chiudi scheda mago' }).click();
});

test('la sequenza automatica si può fermare, riprendere e rendere immediata; preferenza conservata', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'spellsword', 4, 4); put(match, 'blue', 'geomancer', 5, 4);
  await open(page, match, false); await cast(page, 'spellsword', 'F6');
  await page.getByRole('button', { name: 'Pausa sequenza', exact: true }).click();
  const text = await live(page).textContent(); await page.waitForTimeout(1000); await expect(live(page)).toHaveText(text!);
  await page.getByRole('button', { name: 'Riprendi sequenza', exact: true }).click();
  await expect(live(page)).toContainText('4 → 2', { timeout: 5000 });
  await settings(page); await page.getByRole('combobox', { name: 'Riproduzione delle azioni' }).selectOption('instant');
  await expect(live(page)).toHaveAttribute('data-playing', 'false');
  await page.reload(); await settings(page); await expect(page.getByRole('combobox', { name: 'Riproduzione delle azioni' })).toHaveValue('instant');
  await expect(cell(page, 'F6').locator('.mage-hp')).toHaveText('2');
});

test('il computer attende la sequenza, la velocità resta modificabile e il replay non produce mosse', async ({ page }) => {
  const match = scenario(); match.game.turn = 0; match.computer = { side: 'both', profile: 'didactic-v1', speed: 'instant' };
  await open(page, match);
  await expect(live(page)).toHaveAttribute('data-playing', 'true', { timeout: 10000 });
  const committed = await exported(page); expect(committed.revision).toBe(1);
  await page.waitForTimeout(1000); expect((await exported(page)).revision).toBe(1);
  await settings(page); await page.getByRole('combobox', { name: 'Velocità dei computer' }).selectOption('slowest');
  await expect(page.getByRole('combobox', { name: 'Velocità dei computer' })).toBeEnabled();
  const adjusted = await exported(page); expect(adjusted.game).toEqual(committed.game); expect(adjusted.computer?.speed).toBe('slowest');
  await page.getByRole('button', { name: 'Pausa duello' }).click(); await page.getByRole('button', { name: 'Mostra esito' }).click();
  await page.getByRole('button', { name: 'Rivedi ultimo turno avversario' }).click(); await page.getByRole('button', { name: 'Torna alla partita' }).click();
  expect((await exported(page)).revision).toBe(adjusted.revision);
  await page.getByRole('button', { name: 'Riprendi duello' }).click();
  await settings(page); await page.getByRole('combobox', { name: 'Riproduzione delle azioni' }).selectOption('instant');
  await settings(page); await page.getByRole('combobox', { name: 'Velocità dei computer' }).selectOption('instant');
  await expect.poll(async () => Number(await page.getByTestId('computer-state').getAttribute('data-revision')), { timeout: 15000 }).toBeGreaterThan(adjusted.revision + 1);
});

test('ricaricare durante la sequenza riprende dallo stato salvato; errore di salvataggio non avvia eventi', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'spellsword', 4, 4); put(match, 'blue', 'geomancer', 5, 4);
  await open(page, match); await cast(page, 'spellsword', 'F6'); await expect(live(page)).toHaveAttribute('data-playing', 'true');
  await page.reload(); await settings(page); await expect(live(page)).toHaveAttribute('data-playing', 'false'); await expect(cell(page, 'F6').locator('.mage-hp')).toHaveText('2');
  await page.getByRole('button', { name: 'Annulla attivazione', exact: true }).click();
  await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException('Scrittura bloccata nel collaudo', 'QuotaExceededError'); }; });
  await cast(page, 'spellsword', 'F6');
  await expect(page.getByRole('alert').first()).toContainText('Salvataggio non riuscito');
  await expect(live(page)).toHaveAttribute('data-playing', 'false');
  await page.getByRole('button', { name: 'Azzera preparazione' }).click(); await expect(cell(page, 'F6').locator('.mage-hp')).toHaveText('4');
});

test('movimento prima e dopo l’abilità segue il percorso esatto nella presentazione', async ({ page }) => {
  const match = scenario(); put(match, 'red', 'spellsword', 4, 4); put(match, 'blue', 'geomancer', 5, 3);
  await open(page, match); await cell(page, 'E6').click(); await cell(page, 'E7').click();
  await page.getByRole('button', { name: 'Usa abilità', exact: true }).click(); await cell(page, 'F7').click(); await cell(page, 'E6').click();
  await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click();
  await expect(cell(page, 'E6')).toHaveAttribute('data-wizard-id', 'red:spellsword');
  await next(page, 'Movimento'); await expect(cell(page, 'E7')).toHaveAttribute('data-wizard-id', 'red:spellsword');
  await expect(page.locator('.path-overlay')).toBeVisible();
  await next(page, 'Lamarcana Rosso: Lama arcana'); await expect(cell(page, 'F7')).toHaveClass(/event-focus/);
  await next(page, 'Danno'); await expect(cell(page, 'F7').locator('.mage-hp')).toHaveText('2');
  await next(page, 'Movimento'); await expect(cell(page, 'E6')).toHaveAttribute('data-wizard-id', 'red:spellsword');
  await page.getByRole('button', { name: 'Mostra esito' }).click();
  await expect(live(page)).toContainText('E6 → E7'); await expect(live(page)).toContainText('E7 → E6');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/presentation-mobile.png', fullPage: true });
});

test('Computer vs Computer completa una partita con tutte le sequenze automatiche attive', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => { Math.random = () => .8; });
  const match = newMatch({ ...defaultOptions, hp: 3, walls: 'varied', redName: 'Computer Rosso', blueName: 'Computer Blu' }, () => .8);
  match.computer = { side: 'both', profile: 'didactic-v1', speed: 'instant' };
  await open(page, match, false); await expect(page.getByRole('combobox', { name: 'Riproduzione delle azioni' })).toHaveValue('automatic');
  await expect(live(page)).toHaveAttribute('data-playing', 'true', { timeout: 10000 });
  await page.evaluate(async () => {
    scrollTo(0, 100); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const samples: number[][] = [];
    const sample = () => { const b = document.querySelector('.board-grid')!.getBoundingClientRect(), p = document.querySelector('.action-dock')!.getBoundingClientRect(); samples.push([scrollY, b.top, b.height, p.top, p.height]); };
    sample(); (window as unknown as { swLayout: { timer: ReturnType<typeof setInterval>; samples: number[][] } }).swLayout = { timer: setInterval(sample, 50), samples };
  });
  await expect(page.getByTestId('computer-state')).toHaveText('Duello concluso', { timeout: 100000 });
  await expect(live(page)).toHaveAttribute('data-playing', 'false');
  const variations = await page.evaluate(() => {
    const state = (window as unknown as { swLayout: { timer: ReturnType<typeof setInterval>; samples: number[][] } }).swLayout;
    clearInterval(state.timer); return state.samples[0].map((_, i) => Math.max(...state.samples.map(s => s[i])) - Math.min(...state.samples.map(s => s[i])));
  });
  for (const delta of variations) expect(delta, JSON.stringify(variations) + ' Il campo deve restare fermo anche fra danni, eliminazioni e vittoria').toBeLessThan(1.5);
  await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button', { name: 'Osserva il campo' }).click();
  const finished = await exported(page); expect(finished.game.result).not.toBeNull(); expect(finished.game.turn).toBeGreaterThan(2);
  await page.getByText(/Cronaca del duello ·/).click(); await expect(page.locator('.game-history[open]')).toBeVisible();
});
