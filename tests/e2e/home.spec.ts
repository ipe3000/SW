import { newMatch } from '../../src/engine/game';
import { test, expect } from '@playwright/test';

for (const width of [1366, 768, 390, 320]) test(`ingresso compatto, regole dirette e ripresa in modale a ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Battaglia tra gilde magiche', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menù', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Importa partita' })).toBeHidden();
  await expect(page.locator('.saved-list')).toBeHidden();
  for (const name of ['Due giocatori', 'Contro il computer', 'Computer vs Computer', 'Online con un amico']) {
    await page.getByRole('radio', { name, exact: true }).check();
    await page.locator('.entry-artwork img').evaluate(img => img.decode());
    if (width > 900) {
      const picture = await page.locator('.entry-artwork').boundingBox(), panel = await page.locator('.new-game').boundingBox();
      expect(Math.abs(picture!.y - panel!.y)).toBeLessThan(1);
      expect(Math.abs(picture!.height - panel!.height)).toBeLessThan(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('radio', { name: 'Due giocatori', exact: true }).check();
  await page.getByRole('textbox', { name: 'Giocatore Rosso' }).fill('Gilda di prova');
  await page.getByRole('button', { name: 'Regole', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Regole del gioco' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chiudi regole' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Regole', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Giocatore Rosso' })).toHaveValue('Gilda di prova');
  await page.getByRole('button', { name: 'Riprendi partita', exact: true }).click();
  const saves = page.getByRole('dialog', { name: 'Riprendi partita', exact: true });
  await expect(saves).toBeVisible();
  await expect(saves).toContainText('Non ci sono partite salvate');
  await expect(saves.getByRole('button', { name: 'Importa partita' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Riprendi partita', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Inizia partita locale' })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `test-results/home-refined-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  await expect(page.locator('.board-grid')).toBeVisible();
  await page.getByRole('button', { name: 'Menù', exact: true }).click();
  await page.getByRole('button', { name: 'Torna alla pagina iniziale', exact: true }).click();
  await page.getByRole('button', { name: 'Esci e torna all’inizio' }).click();
  await expect(page.locator('.saved-list')).toBeHidden();
  await page.getByRole('button', { name: 'Riprendi partita', exact: true }).click();
  await expect(saves.locator('.saved-list button')).toHaveCount(1);
  await saves.locator('.saved-list button').click();
  await expect(page.locator('.board-grid')).toBeVisible();
  await expect(saves).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('importa un salvataggio v1 e cambia lingua senza perdere la partita', async ({ page }) => {
  const { replays: _replays, ...legacy } = newMatch();
  await page.goto('./');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'New match' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume match', exact: true }).click();
  await page.getByTestId('import-game').setInputFiles({
    name: 'legacy-v1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...legacy, version: 1 })),
  });
  await expect(page.locator('[data-square]')).toHaveCount(100);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByLabel('Language', { exact: true }).selectOption('it');
  await page.getByRole('button', { name: 'Torna alla partita', exact: true }).click();
  await expect(page.locator('[data-square="B1"]')).toHaveAccessibleName(/^Casella B1/);
  await page.reload();
  await expect(page.locator('[data-square="B1"]')).toHaveAccessibleName(/^Casella B1/);
});
