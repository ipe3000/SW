import { settings, matchMenu, closeMenu, openRules } from './ui';
import { test, expect, type Page } from '@playwright/test';
import { newMatch, defaultOptions, type Match } from '../../src/engine/game';

test('ingresso Fantasy Realism: quattro modalità, opzioni su richiesta e nessun riquadro vuoto', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('./');
  await expect(page.getByRole('group', { name: 'Modalità' }).getByRole('radio')).toHaveCount(4);
  await expect(page.locator('.setup-options')).not.toHaveAttribute('open');
  await expect(page.locator('.setup-options > summary')).toContainText('4 PV');
  await expect(page.locator('.entry-saves .saved-list')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inizia partita locale' })).toBeInViewport();
  await expect(page.getByTestId('import-game')).toBeAttached();
  await expect.poll(() => page.locator('.entry-scene img').evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await page.locator('.setup-options > summary').click();
  await page.getByRole('combobox', { name: 'Punti vita iniziali' }).selectOption('5');
  await page.locator('.setup-options > summary').click();
  await expect(page.locator('.setup-options > summary')).toContainText('5 PV');
  await page.screenshot({ path: 'test-results/realism-entry-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/realism-entry-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  await expect(page.locator('.board-grid .mage-hp').first()).toHaveText('5');
  await expect(page.locator('.action-presentation [data-testid="action-presentation"]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Rivedi ultimo turno avversario' })).toBeVisible();
  await page.getByRole('button', { name: 'Menù', exact: true }).click();
  await expect(page.locator('.settings-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi menù' }).click();
  await expect(page.getByRole('button', { name: 'Menù', exact: true })).toBeFocused();
});

async function open(page: Page, match: Match) {
  await page.goto('./'); await page.getByTestId('import-game').setInputFiles({ name: 'layout.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(match)) });
}

for (const width of [1366, 390]) test(`titolo, emblema e regolamento completo a ${width}px senza perdere la preparazione`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 768 }); await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Battaglia tra gilde magiche.', exact: true })).toBeVisible();
  await expect(page.locator('.entry-scene-caption > p')).toHaveText('8 MAGHI CONTRO 8 MAGHI');
  await expect(page.locator('.brand-sigil')).toBeVisible();
  await expect(page.locator('.brand-diamond')).toHaveCount(0);
  const font = await page.locator('.brand-wordmark').evaluate(async el => { const loaded = await document.fonts.load('700 20px "Cinzel Decorative"'); return { family: getComputedStyle(el).fontFamily, loaded: loaded.some(face => face.status === 'loaded') }; });
  expect(font.family).toContain('Cinzel Decorative'); expect(font.loaded).toBe(true);
  const brand = await page.locator('.brand').boundingBox(), rules = await page.getByRole('button', { name: 'Menù', exact: true }).boundingBox();
  expect(brand!.x + brand!.width).toBeLessThanOrEqual(rules!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/guild-brand-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  await page.locator('[data-wizard-id="red:aeromancer"]').click(); await page.locator('[data-square="F2"]').click();
  const budget = await page.locator('.draft-budget').innerText(), board = await page.locator('.board-grid').boundingBox(), url = page.url();
  await openRules(page);
  const dialog = page.getByRole('dialog', { name: 'Regole del gioco' });
  await expect(dialog).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Torna al menù' })).toBeFocused();
  await expect(dialog.locator('.rules-index button')).toHaveCount(9);
  await expect(dialog.locator('.rules-mage')).toHaveCount(8);
  await dialog.getByRole('button', { name: '6. Gli otto maghi', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: '6. Gli otto maghi', exact: true })).toBeInViewport();
  await page.screenshot({ path: `test-results/complete-rules-${width}.png` });
  await dialog.getByRole('button', { name: 'Torna al menù' }).click();
  await expect(page.getByRole('button', { name: 'Regole del gioco', exact: true })).toBeFocused();
  await closeMenu(page);
  await expect(page.locator('.draft-budget')).toHaveText(budget); expect(await page.locator('.board-grid').boundingBox()).toEqual(board);
  expect(page.url()).toBe(url); expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await openRules(page); await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await closeMenu(page);
});

test('online è una delle quattro modalità e mantiene accessibili inviti e ritorno alle altre scelte', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('group', { name: 'Modalità' }).getByRole('radio')).toHaveCount(4);
  await page.getByRole('radio', { name: 'Online con un amico' }).check();
  await expect(page.getByRole('radio', { name: 'Online con un amico' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Crea duello e invito' })).toBeVisible();
  await page.locator('.join-online-entry > summary').click(); await expect(page.getByRole('button', { name: 'Entra nel duello' })).toBeDisabled();
  await expect(page.getByTestId('import-online')).toBeAttached();
  await expect(page.getByRole('textbox', { name: 'Giocatore Rosso' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Online con un amico' })).toBeChecked();
  await page.getByRole('radio', { name: 'Contro il computer' }).check();
  await expect(page.getByRole('button', { name: 'Gioca contro il computer' })).toBeVisible();
  await expect(page).not.toHaveURL(/online=1/);
  await page.getByRole('radio', { name: 'Due giocatori', exact: true }).check();
  await expect(page.getByRole('textbox', { name: 'Giocatore Rosso' })).toBeVisible();
  await page.getByRole('radio', { name: 'Online con un amico' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: 'Contro il computer' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Contro il computer' })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('radio', { name: 'Online con un amico' }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('Computer vs Computer mantiene fermi pagina, campo e pannello durante le sequenze', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); match.game.turn = 2;
  match.computer = { side: 'both', profile: 'didactic-v1', speed: 'instant' };
  await open(page, match); await expect(page.getByTestId('action-presentation')).toHaveAttribute('data-playing', 'true');
  const result = await page.evaluate(async () => {
    scrollTo(0, 120); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const samples: number[][] = [];
    for (let i = 0; i < 100; i++) {
      const board = document.querySelector('.board-grid')!.getBoundingClientRect(), panel = document.querySelector('.action-dock')!.getBoundingClientRect();
      samples.push([scrollY, board.top, board.height, panel.top, panel.height, document.querySelector('.game-grid')!.getBoundingClientRect().height]);
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    return samples[0].map((_, index) => Math.max(...samples.map(s => s[index])) - Math.min(...samples.map(s => s[index])));
  });
  expect(result, 'Variazioni di scroll, campo e pannelli in pixel').toEqual(result.map(() => expect.any(Number)));
  for (const difference of result) expect(difference).toBeLessThan(1.5);
  await page.getByRole('button', { name: 'Pausa duello' }).click();
  await page.evaluate(() => scrollTo(0, 160)); expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: 'test-results/stable-spectator.png', fullPage: true });
});

test('le copie mantengono la gilda e gli emblemi sostituiscono le sigle', async ({ page }) => {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  match.game.log = ['Spellsword Rosso: cronaca da un salvataggio precedente.'];
  match.game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 4, y: 4 } }, { ownerId: 'blue:illusionist', side: 'blue', pos: { x: 5, y: 4 } }];
  await open(page, match);
  const red = page.locator('.board-grid .illusion-token.red'), blue = page.locator('.board-grid .illusion-token.blue');
  await expect(page.locator('.illusion-token .mage-hp, .illusion-token .copy-guild')).toHaveCount(0);
  await expect(page.locator('.mage-abbr')).toHaveCount(0);
  await expect(page.locator('.board-grid [data-emblem]')).toHaveCount(18);
  const meadow = await page.locator('.meadow-board').evaluate(async el => {
    const style = getComputedStyle(el), img = new Image();
    img.src = style.backgroundImage.slice(5, -2); await img.decode();
    return { loaded: img.naturalWidth > 0, cells: [...el.querySelectorAll('.cell:not(.wall)')].map(c => getComputedStyle(c).backgroundColor) };
  });
  expect(meadow.loaded).toBe(true);
  expect(new Set(meadow.cells)).toEqual(new Set(['rgba(0, 0, 0, 0)']));
  await expect(red.locator('[data-emblem="illusionist"]')).toBeVisible(); await expect(blue.locator('[data-emblem="illusionist"]')).toBeVisible();
  for (const side of ['red', 'blue']) {
    const original = page.locator(`[data-wizard-id="${side}:illusionist"] .mage-token`), copy = page.locator(`.board-grid .illusion-token.${side}`);
    const appearance = (token: typeof original) => token.evaluate(el => {
      const s = getComputedStyle(el), bounds = el.getBoundingClientRect(), eye = el.querySelector('[data-emblem]')!, box = eye.getBoundingClientRect();
      return { border: s.border, background: s.backgroundImage, opacity: s.opacity, color: getComputedStyle(eye).color, emblem: eye.innerHTML, centerX: box.x + box.width / 2 - bounds.x - bounds.width / 2, centerY: box.y + box.height / 2 - bounds.y - bounds.height / 2 };
    });
    const [a, b] = await Promise.all([appearance(original), appearance(copy)]);
    expect(a.border).toBe(b.border); expect(a.emblem).toBe(b.emblem); expect(a.background).not.toBe(b.background);
    const rgba = (css: string) => css.match(/rgba?\(([^)]+)\)/)![1].split(',').map(Number);
    const tint = rgba(b.background), alpha = tint[3];
    expect(alpha).toBeGreaterThan(0); expect(alpha).toBeLessThan(1); expect(b.opacity).toBe('1');
    if (side === 'red') { expect(tint[0]).toBeGreaterThan(tint[1]); expect(tint[0]).toBeGreaterThan(tint[2]); }
    else { expect(tint[2]).toBeGreaterThan(tint[0]); expect(tint[2]).toBeGreaterThan(tint[1]); }
    expect(Math.abs(b.centerX)).toBeLessThan(.5); expect(Math.abs(b.centerY)).toBeLessThan(.5);
    const ground = rgba(await page.locator('.meadow-board').evaluate(el => getComputedStyle(el).backgroundColor));
    const luminance = (css: string) => { const color = rgba(css), opacity = color[3] ?? 1; return color.slice(0, 3).map((n, i) => (n * opacity + ground[i] * (1-opacity)) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0); };
    expect((luminance(b.background) + .05) / (luminance(a.background) + .05)).toBeGreaterThan(5);
    expect((luminance(b.background) + .05) / (luminance(b.color) + .05)).toBeGreaterThan(3);

    expect(await copy.evaluate(el => getComputedStyle(el).borderStyle)).toBe('solid');
  }
  const colors = await Promise.all([red, blue].map(token => token.evaluate(el => getComputedStyle(el).borderColor)));
  expect(colors[0]).not.toBe(colors[1]);
  await expect(page.locator('[data-wizard-id="red:spellsword"] [data-emblem="spellsword"]')).toBeVisible();
  await page.locator('[data-wizard-id="red:spellsword"]').click(); await expect(page.locator('.mage-card h3')).toHaveText('Lamarcana');
  await expect(page.locator('.game-history')).toContainText('Lamarcana Rosso');
  await expect(page.locator('.game-history')).not.toContainText('Spellsword');
  await page.screenshot({ path: 'test-results/guild-copies.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const copy of [red, blue]) {
    const offset = await copy.evaluate(el => { const box = el.getBoundingClientRect(), eye = el.querySelector('[data-emblem]')!.getBoundingClientRect(); return [eye.x + eye.width/2 - box.x - box.width/2, eye.y + eye.height/2 - box.y - box.height/2]; });
    for (const difference of offset) expect(Math.abs(difference)).toBeLessThan(.5);
  }
  await page.locator('.meadow-board').screenshot({ path: 'test-results/guild-copies-mobile.png' });
});

test('il campo usa lo spazio disponibile e i PV rimangono in alto a destra', async ({ page }, testInfo) => {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  await open(page, match);
  for (const [width, height] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const size = await page.locator('.board-grid').evaluate(el => {
      const board = el.getBoundingClientRect(), cell = el.querySelector('button')!.getBoundingClientRect();
      const tokens = [...el.querySelectorAll('.mage-token')].map(token => {
        const face = token.querySelector('.mage-face')!.getBoundingClientRect(), hp = token.querySelector('.mage-hp')!.getBoundingClientRect(), bounds = token.getBoundingClientRect();
        return { faceTop: face.top, hpBottom: hp.bottom, hpTop: hp.top, hpRight: hp.right, top: bounds.top, right: bounds.right, width: bounds.width };
      });
      return { cell: cell.width, top: board.top, bottom: board.bottom, width: board.width, windowHeight: innerHeight, tokens, zoom: devicePixelRatio };
    });
    expect(size.cell, `Campo quasi a tutta altezza a ${width}×${height}`).toBeGreaterThanOrEqual(64);
    expect(size.bottom - size.top).toBeGreaterThan(height * .9);
    expect(size.bottom, 'Tutta la scacchiera deve rimanere visibile').toBeLessThanOrEqual(size.windowHeight);
    expect(size.top).toBeGreaterThanOrEqual(0);
    for (const token of size.tokens) {
      expect(token.hpBottom).toBeLessThanOrEqual(token.faceTop + 3);
      expect(token.hpTop - token.top).toBeLessThan(token.width * .15);
      expect(token.right - token.hpRight).toBeLessThan(token.width * .15);
    }
    if (width === 1366 || width === 1920) await page.screenshot({ path: `test-results/readable-${testInfo.project.name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const beforeHelp = await page.locator('.board-grid').boundingBox();
  await openRules(page);
  await expect(page.getByRole('dialog', { name: 'Regole del gioco' })).toBeVisible();
  expect(await page.locator('.board-grid').boundingBox()).toEqual(beforeHelp);
  await page.getByRole('button', { name: 'Torna al menù', exact: true }).click(); await closeMenu(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('i muri di forza usano la tessera scelta e occupano la casella anche dopo la rotazione', async ({ page }) => {
  const match = newMatch(defaultOptions, () => .3);
  await open(page, match);
  const walls = page.locator('img.force-wall.energy-barrier');
  await expect(walls).toHaveCount(2);
  const check = async () => {
    const images = await walls.evaluateAll(async elements => Promise.all(elements.map(async el => {
      const img = el as HTMLImageElement; await img.decode();
      const bounds = img.getBoundingClientRect(), cell = img.closest('button')!.getBoundingClientRect();
      return { source: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight, gap: Math.max(Math.abs(bounds.x-cell.x), Math.abs(bounds.y-cell.y), Math.abs(bounds.width-cell.width), Math.abs(bounds.height-cell.height)) };
    })));
    for (const image of images) {
      expect(image.source).toMatch(/assets\/force-wall-obsidian\.png$/);
      expect(image.width).toBeGreaterThan(0); expect(image.height).toBe(image.width);
      expect(image.gap).toBeLessThanOrEqual(1.1);
    }
  };
  await check();
  await page.getByRole('button', { name: 'Ruota la scacchiera' }).click();
  await check();
  await page.setViewportSize({ width: 390, height: 844 });
  await check();
  await page.screenshot({ path: 'test-results/force-walls-clear.png', fullPage: true });
});

for (const width of [1366, 390]) test(`menù unico: impostazioni, regole, uscita e ripresa a ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
  await page.goto('./');
  await expect(page.locator('footer')).toHaveCount(0);
  await openRules(page); await page.getByRole('button', { name: 'Torna al menù' }).click();
  await expect(page.getByRole('button', { name: 'Esci dal gioco', exact: true })).toHaveCount(0);
  await closeMenu(page);
  await page.getByRole('button', { name: 'Inizia partita locale' }).click();
  await expect(page.locator('.topbar nav button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Regole del gioco', exact: true })).toHaveCount(0);
  await page.locator('[data-wizard-id="red:aeromancer"]').click();
  await page.locator('[data-square="F2"]').click();
  const budget = await page.locator('.draft-budget').innerText(), board = await page.locator('.board-grid').boundingBox();
  await matchMenu(page);
  const menu = page.getByRole('dialog', { name: 'Menù', exact: true });
  await expect(menu).toBeVisible(); await expect(page.getByRole('button', { name: 'Chiudi menù' })).toBeFocused();
  await expect(menu.locator('.settings-menu')).toBeVisible();
  await menu.getByLabel('Modifica percorso passo per passo').check();
  const pending = page.waitForEvent('download'); await menu.getByRole('button', { name: 'Esporta partita', exact: true }).click();
  expect((await pending).suggestedFilename()).toMatch(/strategic-wizardry-/);
  await menu.getByRole('button', { name: 'Regole del gioco', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Torna al menù' }).click();
  await expect(menu.getByRole('button', { name: 'Regole del gioco', exact: true })).toBeFocused();
  await expect(menu.getByLabel('Modifica percorso passo per passo')).toBeChecked();
  await menu.getByRole('button', { name: 'Esci dal gioco', exact: true }).click();
  const exit = page.getByRole('dialog', { name: 'Uscire dalla partita?' });
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await expect(exit.getByRole('button', { name: 'Continua a giocare' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu.getByRole('button', { name: 'Esci dal gioco', exact: true })).toBeFocused();
  await menu.getByRole('button', { name: 'Esci dal gioco', exact: true }).click();
  await exit.getByRole('button', { name: 'Continua a giocare' }).click();
  await menu.getByRole('button', { name: 'Regole del gioco', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/unified-menu-${width}.png` });
  await closeMenu(page);
  await expect(page.getByRole('button', { name: 'Menù', exact: true })).toBeFocused();
  await expect(page.locator('.draft-budget')).toHaveText(budget); expect(await page.locator('.board-grid').boundingBox()).toEqual(board);
  await matchMenu(page); await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await page.locator('.brand').click(); await exit.getByRole('button', { name: 'Esci e torna all’inizio' }).click();
  await expect(page.locator('.fantasy-entry')).toBeVisible();
  await page.reload(); await expect(page.locator('.fantasy-entry')).toBeVisible();
  await page.locator('.saved-list button').first().click();
  await expect(page.locator('[data-square="F1"]')).toHaveAttribute('data-wizard-id', 'red:aeromancer');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('menù online: collegamento, backup e uscita senza rientro automatico', async ({ page }) => {
  await page.goto('./?online=1');
  await page.getByRole('button', { name: 'Crea duello e invito' }).click();
  await matchMenu(page);
  await expect(page.getByRole('region', { name: 'Collegamento online' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Esporta backup personale', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Esci dal gioco', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Uscire dalla partita?' });
  await expect(dialog).toContainText('Il collegamento');
  await dialog.getByRole('button', { name: 'Esci e torna all’inizio' }).click();
  await expect(page.locator('.fantasy-entry')).toBeVisible();
  await page.reload(); await expect(page.locator('.fantasy-entry')).toBeVisible();
  await expect(page.locator('.saved-list button')).toHaveCount(1);
});
