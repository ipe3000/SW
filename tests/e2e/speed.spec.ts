import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { importMatch } from '../../src/engine/backup';

const speed = (page: Page) => page.getByRole('combobox', { name: 'Velocità dei computer', exact: true });
async function create(page: Page, custom = false) {
  await page.goto('./'); await page.getByRole('radio', { name: 'Computer vs Computer', exact: true }).check();
  await speed(page).selectOption('slowest');
  if (custom) await page.getByRole('combobox', { name: 'Schieramento', exact: true }).selectOption('custom');
  await page.screenshot({ path: 'test-results/computer-speed-setup.png', fullPage: true });
  await page.getByRole('button', { name: 'Avvia Computer vs Computer' }).click();
  await expect(speed(page)).toHaveValue('slowest');
}
async function exported(page: Page) {
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Esporta partita' }).click();
  return importMatch(await readFile((await (await download).path())!, 'utf8'));
}

test('velocità configurabile prima e durante la partita, anche in pausa e dopo ricarica', async ({ page }) => {
  await create(page);
  await page.waitForTimeout(900); expect((await exported(page)).revision).toBe(0);
  await speed(page).selectOption('instant');
  await expect.poll(async () => Number(await page.getByTestId('computer-state').getAttribute('data-revision'))).toBeGreaterThan(1);
  await speed(page).selectOption('slowest'); await expect(speed(page)).toBeEnabled();
  const slower = await exported(page); expect(slower.computer?.speed).toBe('slowest');
  await page.waitForTimeout(1000); expect((await exported(page)).revision).toBe(slower.revision);
  await page.getByRole('button', { name: 'Metti in pausa il computer' }).click();
  const paused = await exported(page);
  await speed(page).selectOption('fast'); await expect(page.getByTestId('computer-state')).toHaveText('Computer in pausa');
  const adjusted = await exported(page); expect(adjusted.computer?.speed).toBe('fast'); expect(adjusted.game).toEqual(paused.game);
  await page.screenshot({ path: 'test-results/computer-speed-playing.png', fullPage: true });
  await page.reload(); await expect(speed(page)).toHaveValue('fast');
  await page.getByRole('button', { name: 'Metti in pausa il computer' }).click();
  expect((await exported(page)).computer?.speed).toBe('fast');
});

test('cambiare velocità durante lo schieramento modifica subito il ritmo delle collocazioni', async ({ page }) => {
  await create(page, true); await page.waitForTimeout(800);
  await expect(page.locator('[data-wizard-id]')).toHaveCount(0);
  await speed(page).selectOption('instant');
  await expect(page.getByRole('heading', { name: 'Il turno di Computer Rosso.' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Metti in pausa il computer' }).click();
  const value = await exported(page); expect(value.game.stage).toBe('playing'); expect(value.game.wizards).toHaveLength(16); expect(value.computer?.speed).toBe('instant');
});

test('la velocità si può modificare mentre una mossa viene salvata senza perdere o duplicare fasi', async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')!;
    const state = window as unknown as { holdSaveCompletion: boolean; waitingForSave: boolean };
    state.holdSaveCompletion = false; state.waitingForSave = false;
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', {
      configurable: true, get: descriptor.get,
      set(handler) {
        descriptor.set!.call(this, function(this: IDBTransaction, event: Event) {
          if (state.holdSaveCompletion && this.objectStoreNames.contains('games')) {
            state.waitingForSave = true;
            setTimeout(() => { state.waitingForSave = false; handler.call(this, event); }, 800);
          } else handler.call(this, event);
        });
      }
    });
  });
  await create(page); await speed(page).selectOption('fast'); await expect(speed(page)).toBeEnabled();
  await page.evaluate(() => { (window as unknown as { holdSaveCompletion: boolean }).holdSaveCompletion = true; });
  await expect.poll(() => page.evaluate(() => (window as unknown as { waitingForSave: boolean }).waitingForSave)).toBe(true);
  await speed(page).selectOption('slowest');
  await page.evaluate(() => { (window as unknown as { holdSaveCompletion: boolean }).holdSaveCompletion = false; });
  await expect(speed(page)).toBeEnabled();
  const value = await exported(page);
  expect(value.computer?.speed).toBe('slowest'); expect(value.game.turn).toBe(0); expect(value.game.phase).toBe(3);
  expect(value.game.log.filter(row => row.startsWith('Rosso ·'))).toHaveLength(1);
  await page.waitForTimeout(700); expect((await exported(page)).revision).toBe(value.revision);
});

test('un errore nel salvataggio della velocità mantiene la partita e la scelta precedenti', async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, ...rest) {
      if (this.name === 'games' && value?.match?.computer?.speed === 'instant') throw new DOMException('Storage error for test', 'QuotaExceededError');
      return put.call(this, value, ...rest);
    };
  });
  await create(page); const before = await exported(page);
  await speed(page).selectOption('instant');
  await expect(page.getByTestId('computer-state')).toHaveText('Il computer si è fermato');
  await expect(speed(page)).toHaveValue('slowest');
  const after = await exported(page); expect(after).toEqual(before);
  await speed(page).selectOption('fast'); await expect(speed(page)).toBeEnabled();
  expect((await exported(page)).computer?.speed).toBe('fast');
  await page.getByRole('button', { name: 'Riprova', exact: true }).click();
  await expect.poll(async () => Number(await page.getByTestId('computer-state').getAttribute('data-revision'))).toBeGreaterThan(after.revision + 1);
});
