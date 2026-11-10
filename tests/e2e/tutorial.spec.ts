import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1366, height: 768 }, { width: 360, height: 640 }]) {
  test(`tutorial completo a ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('sw-presentation-mode', 'instant'));
    await page.goto('./');
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    const cell = (square: string) => page.locator(`.tutorial-app [data-square="${square}"]`);
    const guide = page.getByRole('region', { name: 'Guida del tutorial' });
    await expect(page.getByRole('navigation', { name: 'Navigazione di gioco' }).getByRole('button')).toHaveText(['Tutorial', 'Regole', 'Suoni: off']);
    await expect(button('Effetti sonori')).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('textbox', { name: 'Giocatore Rosso' }).fill('Gilda di prova');
    await button('Tutorial').click();
    await expect(page.getByRole('heading', { name: 'Avvicinati e colpisci' })).toBeFocused();
    await expect(guide).toBeVisible();
    const header = page.locator('.tutorial-app .topbar');
    const brandBox = (await header.getByRole('link', { name: 'Torna alla pagina iniziale' }).boundingBox())!;
    const exitBox = (await button('Esci dal tutorial').boundingBox())!;
    expect(brandBox.x + brandBox.width).toBeLessThan(exitBox.x);
    if (viewport.width > 760) {
      const heading = (await page.locator('.tutorial-app .game-heading').boundingBox())!;
      expect((await guide.boundingBox())!.y - heading.y - heading.height).toBeLessThan(40);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await button('Esci dal tutorial').click();
    await expect(button('Tutorial')).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Giocatore Rosso' })).toHaveValue('Gilda di prova');
    await button('Tutorial').click();

    const board = page.locator('.tutorial-app .board-grid');
    const boardWidth = (await board.boundingBox())!.width;
    await cell('D3').focus();
    await page.keyboard.press('ArrowUp');
    await expect(cell('D4')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(cell('D3')).toBeFocused();
    await button('Mostra indizio').click();
    await expect(guide).toContainText('scegli D5');
    expect((await board.boundingBox())!.width).toBeCloseTo(boardWidth, 0);
    await cell('D3').click();
    await cell('D5').click();
    await button('Conferma e passa turno').click();
    await expect(page.getByRole('alert')).toContainText('prepara Lama arcana');
    await button('Riprova').click();
    await expect(cell('D3')).toHaveAttribute('data-wizard-id', 'red:spellsword');
    await cell('D3').click();
    await cell('D5').click();
    await button('Prepara abilità').click();
    await cell('D6').click();
    await expect(cell('D6')).toHaveAccessibleName(/2 punti vita/);
    await expect(guide).toContainText('Anteprima');
    await button('Conferma e passa turno').click();
    await expect(guide).toContainText('Il Rosso apre con una sola attivazione');
    await button('Prossima prova').click();

    await cell('D3').click();
    await button('Prepara abilità').click();
    await cell('D5').click();
    await cell('E5').click();
    await button('Concludi abilità').click();
    await button('Conferma attivazione').click();
    await expect(cell('E5')).toHaveAttribute('data-wizard-id', 'blue:geomancer');
    await button('Annulla attivazione').click();
    await expect(cell('D5')).toHaveAttribute('data-wizard-id', 'blue:geomancer');
    await cell('D3').click();
    await button('Prepara abilità').click();
    await cell('D5').click();
    await cell('E5').click();
    if (viewport.width < 500) await cell('F5').click();
    await button('Concludi abilità').click();
    await button('Conferma attivazione').click();
    await cell('F3').click();
    await button('Prepara abilità').click();
    await cell('F5').click();
    await button('Conferma attivazione').click();
    await expect(guide).toContainText('Il Passo extra è facoltativo');
    if (viewport.width < 500) {
      await cell('C2').click();
      await cell('C3').click();
      await button('Conferma e passa turno').click();
    } else await button('Salta passo extra').click();
    await button('Prossima prova').click();

    await cell('D3').click();
    await cell('D5').click();
    await button('Prepara abilità').click();
    await cell('D6').click();
    await button('Conferma e concludi partita').click();
    await expect(guide).toContainText('Tutorial completato');
    await button('Gioca contro il computer').click();
    await expect(page.locator('.board-grid')).toBeVisible();
    await expect(page.locator('.tutorial-app')).toHaveCount(0);
    await expect(page.locator('[data-wizard-id]')).toHaveCount(16);
  });
}
