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
  await expect(page.locator('.illusion-token .mage-hp, .illusion-token .copy-guild')).toHaveCount(0);
  await expect(red.locator('.mage-abbr')).toHaveText('COPIA'); await expect(blue.locator('.mage-abbr')).toHaveText('COPIA');
  const colors = await Promise.all([red, blue].map(token => token.locator('.mage-footer').evaluate(el => getComputedStyle(el).backgroundColor)));
  expect(colors[0]).not.toBe(colors[1]);
  await expect(page.locator('[data-wizard-id="red:spellsword"] .mage-abbr')).toHaveText('LAM');
  await page.locator('[data-wizard-id="red:spellsword"]').click(); await expect(page.locator('.mage-card h3')).toHaveText('Lamarcana');
  await expect(page.locator('.game-history')).toContainText('Lamarcana Rosso');
  await expect(page.locator('.game-history')).not.toContainText('Spellsword');
  await page.screenshot({ path: 'test-results/guild-copies.png', fullPage: true });
});

test('a zoom 100% il campo usa lo spazio del desktop e i PV non coprono i volti', async ({ page }, testInfo) => {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  await open(page, match);
  for (const [width, height] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const size = await page.locator('.board-grid').evaluate(el => {
      const board = el.getBoundingClientRect(), cell = el.querySelector('button')!.getBoundingClientRect();
      const tokens = [...el.querySelectorAll('.mage-token')].map(token => {
        const face = token.querySelector('.mage-face')!.getBoundingClientRect(), hp = token.querySelector('.mage-hp')!.getBoundingClientRect(), footer = token.querySelector('.mage-footer')!.getBoundingClientRect();
        return { faceBottom: face.bottom, hpTop: hp.top, footerTop: footer.top };
      });
      return { cell: cell.width, top: board.top, bottom: board.bottom, width: board.width, windowHeight: innerHeight, tokens, zoom: devicePixelRatio };
    });
    expect(size.cell, `Caselle leggibili a ${width}×${height}`).toBeGreaterThanOrEqual(49);
    expect(size.bottom, 'Tutta la scacchiera deve rimanere visibile').toBeLessThanOrEqual(size.windowHeight);
    expect(size.top).toBeGreaterThanOrEqual(0);
    for (const token of size.tokens) { expect(token.hpTop).toBeGreaterThanOrEqual(token.faceBottom - .5); expect(token.footerTop).toBeGreaterThanOrEqual(token.faceBottom - .5); }
    if (width === 1366 || width === 1920) await page.screenshot({ path: `test-results/readable-${testInfo.project.name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
