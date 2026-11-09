import { closeMenu, settings, matchMenu, setupOptions } from './ui';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { newMatch, defaultOptions, wizard, type Match } from '../../src/engine/game';
import { importMatch } from '../../src/engine/backup';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('sw-presentation-mode', 'instant')); });

const cell = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);
async function create(page: Page, human = 'red', custom = false) {
  await page.goto('./'); await page.getByRole('radio', { name: 'Contro il computer' }).check();
  await page.getByRole('combobox', { name: 'La tua gilda' }).selectOption(human);
  if (custom) { await setupOptions(page); await page.getByRole('combobox', { name: 'Schieramento', exact: true }).selectOption('custom'); }
  await page.screenshot({ path: 'test-results/computer-settings.png', fullPage: true });
  await page.getByRole('button', { name: 'Gioca contro il computer' }).click();
}
async function exported(page: Page): Promise<Match> {
  const download = page.waitForEvent('download'); await matchMenu(page); await page.getByRole('button', { name: 'Esporta partita' }).click();
  const value = importMatch(await readFile((await (await download).path())!, 'utf8')); await closeMenu(page); return value;
}
async function importGame(page: Page, value: Match) {
  await page.goto('./'); await page.getByTestId('import-game').setInputFiles({ name: 'computer.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
}

test('Computer vs Computer: partita completa, pausa, ripresa e ricarica', async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => { Math.random = () => .8; });
  await page.goto('./'); await page.getByRole('radio', { name: 'Computer vs Computer', exact: true }).check();
  await expect(page.getByRole('combobox', { name: 'La tua gilda' })).toHaveCount(0);
  await setupOptions(page); await page.getByRole('combobox', { name: 'Punti vita iniziali' }).selectOption('3');
  await setupOptions(page); await page.getByRole('combobox', { name: 'Muri di forza' }).selectOption('varied');
  await page.getByRole('button', { name: 'Avvia Computer vs Computer' }).click();
  await expect(page.getByRole('heading', { name: 'Il turno di Computer Blu.' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Pausa duello' }).click();
  await expect(page.getByTestId('computer-state')).toHaveText('Computer in pausa');
  const paused = await exported(page); expect(paused.computer?.side).toBe('both'); expect(paused.game.active).toBe('blue');
  await page.waitForTimeout(900); expect((await exported(page)).revision).toBe(paused.revision);
  await expect(page.getByRole('button', { name: 'Annulla attivazione', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Termina turno', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/computer-vs-computer.png', fullPage: true });
  await page.getByRole('button', { name: 'Riprendi duello' }).click();
  await expect(page.getByRole('heading', { name: 'Il turno di Computer Rosso.' })).toBeVisible({ timeout: 15000 });
  await page.reload();
  await expect(page.getByTestId('computer-state')).toHaveText('Duello concluso', { timeout: 100000 });
  await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button', { name: 'Osserva il campo' }).click();
  const finished = await exported(page);
  expect(finished.computer).toEqual({ profile: 'didactic-v1', side: 'both', speed: 'normal' });
  expect(finished.game.result).not.toBeNull(); expect(finished.game.turn).toBeGreaterThan(2);
  expect(finished.game.log.some(row => row.startsWith('Rosso ·'))).toBe(true);
  expect(finished.game.log.some(row => row.startsWith('Blu ·'))).toBe(true);
});

test('Computer vs Computer: schieramento personalizzato interamente automatico', async ({ page }) => {
  await page.goto('./'); await page.getByRole('radio', { name: 'Computer vs Computer', exact: true }).check();
  await setupOptions(page); await page.getByRole('combobox', { name: 'Schieramento', exact: true }).selectOption('custom');
  await page.getByRole('button', { name: 'Avvia Computer vs Computer' }).click();
  await expect(page.getByRole('heading', { name: 'Il turno di Computer Rosso.' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Pausa duello' }).click();
  const value = await exported(page); expect(value.game.stage).toBe('playing'); expect(value.game.wizards).toHaveLength(16);
  expect(value.game.wizards.every(w => w.pos && w.pos.y === (w.side === 'red' ? 9 : 0))).toBe(true);
  await matchMenu(page); await page.getByRole('button', { name: 'Esci dal gioco' }).click(); await page.getByRole('button', { name: 'Esci e torna all’inizio' }).click();
  await expect(page.locator('.saved-list')).toContainText('Computer vs Computer');
});

test('gioco come Rosso: conferma e annulla, poi il computer svolge il turno', async ({ page }) => {
  await create(page); await expect(page.getByTestId('computer-state')).toHaveText('Tocca a te');
  await cell(page, 'F1').click(); await cell(page, 'F2').click();
  await page.getByRole('button', { name: 'Azzera preparazione' }).click(); await expect(cell(page, 'F1')).toHaveAttribute('data-wizard-id', 'red:aeromancer');
  await cell(page, 'F1').click(); await cell(page, 'F2').click(); await page.locator('.confirm-activation').click();
  await expect(page.getByRole('heading', { name: 'Il turno di Computer didattico.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Annulla attivazione', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('computer-state')).toHaveText('Tocca a te', { timeout: 20000 });
  const value = await exported(page);
  expect(value.computer).toEqual({ profile: 'didactic-v1', side: 'blue' }); expect(value.game.active).toBe('red'); expect(value.game.turn).toBe(2);
  expect(value.game.log.filter(row => row.startsWith('Blu ·'))).toHaveLength(3);
  expect(value.undo).toHaveLength(0);
  await page.screenshot({ path: 'test-results/computer-human-turn.png', fullPage: true });
});

test('gioco come Blu: pausa, ritorno al menu e ripresa del primo turno Rosso', async ({ page }) => {
  await create(page, 'blue'); await page.getByRole('button', { name: 'Pausa duello' }).click();
  await expect(page.getByTestId('computer-state')).toHaveText('Computer in pausa');
  await expect(page.locator('.board-grid button').first()).toHaveAttribute('data-square', 'J1');
  const paused = await exported(page); await page.waitForTimeout(1000);
  expect((await exported(page)).revision).toBe(paused.revision);
  await matchMenu(page); await page.getByRole('button', { name: 'Esci dal gioco' }).click(); await page.getByRole('button', { name: 'Esci e torna all’inizio' }).click(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Riprendi partita', exact: true }).click(); await page.locator('.saved-list button').first().click();
  await expect(page.getByTestId('computer-state')).toHaveText('Tocca a te', { timeout: 20000 });
  const value = await exported(page); expect(value.computer?.side).toBe('red'); expect(value.game.turn).toBe(1);
  expect(value.game.log.filter(row => row.startsWith('Rosso ·'))).toHaveLength(1);
});

test('ricaricare durante il turno del computer riprende senza duplicare le attivazioni', async ({ page }) => {
  const value: Match = { ...newMatch({ ...defaultOptions, blueName: 'Computer didattico' }), computer: { profile: 'didactic-v1', side: 'blue' } };
  value.game.turn = 1; value.game.active = 'blue';
  await importGame(page, value);
  await expect(page.locator('.phase-track [aria-current="step"]')).toHaveText('2° Attivazione', { timeout: 15000 });
  await page.getByRole('button', { name: 'Pausa duello' }).click();
  const halfway = await exported(page); expect(halfway.game.phase).toBe(1); expect(halfway.game.activated).toHaveLength(1);
  await page.reload(); await expect(page.getByTestId('computer-state')).toHaveText('Tocca a te', { timeout: 20000 });
  const resumed = await exported(page); expect(resumed.game.turn).toBe(2); expect(resumed.revision).toBe(3);
  expect(resumed.game.log.filter(row => row.startsWith('Blu ·'))).toHaveLength(3);
});

test('lo schieramento personalizzato alterna automaticamente computer e giocatore', async ({ page }) => {
  await create(page, 'blue', true);
  await expect(page.getByRole('heading', { name: 'Gilda Blu: colloca 6 maghi' })).toBeVisible({ timeout: 15000 });
  let column = 1;
  for (const batch of [6, 2]) {
    for (let i = 0; i < batch; i++) {
      await page.getByRole('button', { name: /^Schiera / }).first().click();
      await cell(page, `${String.fromCharCode(65 + column++)}10`).click();
    }
    if (batch === 6) await expect(page.getByRole('heading', { name: 'Gilda Blu: colloca 2 maghi' })).toBeVisible({ timeout: 15000 });
  }
  await expect(page.getByRole('heading', { name: 'Il turno di Gilda Blu.' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('computer-state')).toHaveText('Tocca a te');
  const value = await exported(page); expect(value.game.stage).toBe('playing'); expect(value.game.wizards).toHaveLength(16); expect(value.game.wizards.every(w => w.pos)).toBe(true);
});

test('un problema del worker conserva la partita e permette di riprovare', async ({ page }) => {
  await page.addInitScript(() => {
    const stored = window as unknown as { Worker: typeof Worker; originalWorker: typeof Worker };
    stored.originalWorker = stored.Worker;
    stored.Worker = class { constructor() { throw new Error('Worker startup failure for test'); } } as unknown as typeof Worker;
  });
  await create(page, 'blue'); await expect(page.getByTestId('computer-state')).toHaveText('Il computer si è fermato');
  expect((await exported(page)).revision).toBe(0);
  await page.waitForTimeout(900); expect((await exported(page)).revision).toBe(0);
  await page.evaluate(() => { const stored = window as unknown as { Worker: typeof Worker; originalWorker: typeof Worker }; stored.Worker = stored.originalWorker; });
  await page.getByRole('button', { name: 'Riprova', exact: true }).click();
  await expect(page.getByTestId('computer-state')).toHaveText('Tocca a te', { timeout: 20000 });
  expect((await exported(page)).game.turn).toBe(1);
});

test('un errore di salvataggio ferma il computer senza perdere lo stato precedente', async ({ page }) => {
  await page.addInitScript(() => {
    const actual = IDBObjectStore.prototype.put;
    (window as unknown as { failComputerSave: boolean }).failComputerSave = true;
    IDBObjectStore.prototype.put = function(value, ...rest) {
      if ((window as unknown as { failComputerSave: boolean }).failComputerSave && this.name === 'games' && value?.match?.revision > 0) throw new DOMException('Storage failure for test', 'QuotaExceededError');
      return actual.call(this, value, ...rest);
    };
  });
  await create(page, 'blue'); await expect(page.getByTestId('computer-state')).toHaveText('Il computer si è fermato', { timeout: 15000 });
  expect((await exported(page)).revision).toBe(0);
  await page.evaluate(() => { (window as unknown as { failComputerSave: boolean }).failComputerSave = false; });
  await page.getByRole('button', { name: 'Riprova', exact: true }).click();
  await expect(page.getByTestId('computer-state')).toHaveText('Tocca a te', { timeout: 20000 });
  expect((await exported(page)).game.turn).toBe(1);
});

test('la conferma del colpo vincente conclude la partita contro il computer', async ({ page }) => {
  const value: Match = { ...newMatch({ ...defaultOptions, walls: 'varied' }, () => .8), computer: { profile: 'didactic-v1', side: 'blue' } };
  value.game.turn = 2;
  wizard(value.game, 'red:spellsword')!.pos = { x: 4, y: 4 }; wizard(value.game, 'blue:spellsword')!.pos = { x: 5, y: 4 }; wizard(value.game, 'blue:spellsword')!.hp = 2;
  value.game.wizards = value.game.wizards.filter(w => w.side === 'red' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
  await importGame(page, value);
  async function attack() { await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Prepara abilità', exact: true }).click(); await cell(page, 'F6').click(); await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click(); }
  await attack();
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('dialog')).toContainText('Hai vinto!'); await page.getByRole('button', { name: 'Osserva il campo' }).click();
  expect((await exported(page)).game.result?.winner).toBe('red');
});

test('il computer conclude automaticamente una vittoria e il backup ne conserva la modalità', async ({ page, browser }) => {
  const value: Match = { ...newMatch({ ...defaultOptions, walls: 'varied' }, () => .8), computer: { profile: 'didactic-v1', side: 'blue' } };
  value.game.turn = 1; value.game.active = 'blue';
  wizard(value.game, 'blue:spellsword')!.pos = { x: 4, y: 4 }; wizard(value.game, 'red:spellsword')!.pos = { x: 5, y: 4 }; wizard(value.game, 'red:spellsword')!.hp = 2;
  value.game.wizards = value.game.wizards.filter(w => w.side === 'blue' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
  await importGame(page, value); await expect(page.getByTestId('computer-state')).toHaveText('Duello concluso', { timeout: 20000 });
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('dialog')).toContainText('sconfitta'); await page.getByRole('button', { name: 'Osserva il campo' }).click();
  const finished = await exported(page); expect(finished.game.result?.winner).toBe('blue'); expect(finished.game.stage).toBe('finished');
  const context = await browser.newContext(); const other = await context.newPage();
  try {
    await other.goto(page.url()); await other.getByTestId('import-game').setInputFiles({ name: 'finished.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(finished)) });
    await expect(other.getByTestId('computer-state')).toHaveText('Duello concluso');
    await expect(other.getByRole('dialog')).toBeVisible(); await other.getByRole('button', { name: 'Osserva il campo' }).click();
    expect((await exported(other)).computer).toEqual(finished.computer);
  } finally { await context.close(); }
});
