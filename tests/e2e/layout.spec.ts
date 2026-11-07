import { test, expect, type Page } from '@playwright/test';
import { newMatch, defaultOptions, type Match } from '../../src/engine/game';

async function open(page: Page, match: Match) {
  await page.goto('./'); await page.getByTestId('import-game').setInputFiles({ name: 'layout.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(match)) });
}
test('Computer vs Computer mantiene fermi pagina, campo e pannello durante le sequenze', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); match.game.turn = 2;
  match.computer = { side: 'both', profile: 'didactic-v1', speed: 'instant' };
  await open(page, match); await expect(page.getByTestId('action-presentation')).toHaveAttribute('data-playing', 'true');
  const result = await page.evaluate(async () => {
    scrollTo(0, 120); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const samples: number[][] = [];
    for (let i = 0; i < 100; i++) {
      const board = document.querySelector('.board-grid')!.getBoundingClientRect(), panel = document.querySelector('.action-presentation')!.getBoundingClientRect();
      samples.push([scrollY, board.top, board.height, panel.top, panel.height, document.querySelector('.game-grid')!.getBoundingClientRect().height]);
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    return samples[0].map((_, index) => Math.max(...samples.map(s => s[index])) - Math.min(...samples.map(s => s[index])));
  });
  expect(result, 'Variazioni di scroll, campo e pannelli in pixel').toEqual(result.map(() => expect.any(Number)));
  for (const difference of result) expect(difference).toBeLessThan(1.5);
  await page.getByRole('button', { name: 'Metti in pausa il computer' }).click();
  await page.evaluate(() => scrollTo(0, 160)); expect(await page.evaluate(() => scrollY)).toBe(160);
  await page.screenshot({ path: 'test-results/stable-spectator.png', fullPage: true });
});

test('le copie mostrano i colori delle rispettive gilde e Lamarcana usa la sigla LAM', async ({ page }) => {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  match.game.log = ['Spellsword Rosso: cronaca da un salvataggio precedente.'];
  match.game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 4, y: 4 } }, { ownerId: 'blue:illusionist', side: 'blue', pos: { x: 5, y: 4 } }];
  await open(page, match);
  const red = page.locator('.board-grid .illusion-token.red'), blue = page.locator('.board-grid .illusion-token.blue');
  await expect(red.locator('.copy-guild')).toHaveText('R'); await expect(blue.locator('.copy-guild')).toHaveText('B');
  const colors = await Promise.all([red, blue].map(token => token.locator('.mage-abbr').evaluate(el => getComputedStyle(el).backgroundColor)));
  expect(colors[0]).not.toBe(colors[1]);
  await expect(page.locator('[data-wizard-id="red:spellsword"] .mage-abbr')).toHaveText('LAM');
  await page.locator('[data-wizard-id="red:spellsword"]').click(); await expect(page.locator('.mage-card h3')).toHaveText('Lamarcana');
  await expect(page.locator('.game-history')).toContainText('Lamarcana Rosso');
  await expect(page.locator('.game-history')).not.toContainText('Spellsword');
  await page.screenshot({ path: 'test-results/guild-copies.png', fullPage: true });
});
