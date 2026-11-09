import { closeMenu, settings, matchMenu } from './ui';
import { test, expect, type Page } from '@playwright/test';
import { defaultOptions, newMatch, wizard, type Match, type Side, type Kind } from '../../src/engine/game';
const cell = (p: Page, name: string) => p.locator(`[data-square="${name}"]`);
const next = (p: Page) => p.getByRole('button', { name: 'Prossimo evento' }).click();
function scenario() { const m = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); m.game.turn = 2; return m; }
function put(m: Match, side: Side, kind: Kind, x: number, y: number, hp = 4) { const w = wizard(m.game, `${side}:${kind}`)!; w.pos = { x, y }; w.hp = hp; }
async function open(page: Page, match: Match) {
  await page.goto('./'); await page.evaluate(() => localStorage.setItem('sw-presentation-mode', 'manual'));
  await page.getByTestId('import-game').setInputFiles({ name: 'effects.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(match)) });
  await expect(page.locator('.board-grid')).toBeVisible();
}
async function cast(page: Page, origin: string, target?: string) {
  await cell(page, origin).click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click(); if (target) await cell(page, target).click(); await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click();
}
test('cuore spezzato e teschio sono distinti dalla copia che svanisce, e l’annullamento usa l’orologio', async ({ page }) => {
  const m = scenario(); put(m, 'red', 'spellsword', 4, 4); put(m, 'blue', 'illusionist', 5, 4, 1); m.game.copies = [{ ownerId: 'blue:illusionist', side: 'blue', pos: { x: 6, y: 4 } }];
  await open(page, m); await cast(page, 'E6', 'F6'); await next(page);
  await expect(page.locator('[data-spell-effect="sword"] .blade-swipe')).toBeVisible(); await next(page);
  const damage = page.locator('[data-cue-symbol="damage"]'); await expect(damage.locator('strong')).toHaveText('−2'); await expect(damage.locator('.icon-damage')).toBeVisible();
  const d = await damage.boundingBox(), mage = await cell(page, 'F6').locator('.mage-face').boundingBox(); expect(d!.y + d!.height / 2).toBeLessThan(mage!.y + mage!.height / 2);
  await page.screenshot({ path: 'test-results/battle-damage.png', fullPage: true }); await next(page);
  await expect(page.locator('[data-cue-square="F6"] .icon-skull')).toBeVisible(); await expect(page.locator('[data-cue-square="G6"] .icon-dissolve')).toBeVisible();
  await expect(page.locator('.copy-owner-link')).toBeVisible(); await expect(cell(page, 'F6').locator('.ghost-death')).toBeVisible(); await expect(cell(page, 'G6').locator('.ghost-copy')).toBeVisible();
  await page.screenshot({ path: 'test-results/battle-elimination.png', fullPage: true });
  await page.getByRole('button', { name: 'Mostra esito' }).click(); await page.getByRole('button', { name: 'Annulla attivazione', exact: true }).click();
  await expect(page.locator('[data-spell-effect="undo"]')).toBeVisible(); await expect(page.locator('[data-cue-symbol="skull"]')).toHaveCount(0);
  await expect(cell(page, 'F6').locator('.mage-hp')).toHaveText('1'); await expect(cell(page, 'G6').locator('.mage-hp')).toHaveCount(0);
});
test('influenza dell’Incantatore, fascino persistente durante il movimento e fine dell’effetto', async ({ page }) => {
  const m = scenario(); put(m, 'red', 'spellsword', 4, 4); put(m, 'blue', 'enchanter', 5, 4);
  await open(page, m); await expect(cell(page, 'E6').locator('.charm-presence')).toHaveCount(0);
  await expect(page.locator('[data-charm-target="red:spellsword"]')).toHaveCount(0);
  await cell(page, 'F6').click(); await expect(page.locator('[data-charm-influence]')).toHaveCount(4);
  await cell(page, 'E6').click(); await expect(cell(page, 'E6').locator('.charm-status')).toBeVisible(); await expect(page.getByRole('button', { name: 'Usa abilità', exact: true })).toBeDisabled();
  await expect(page.locator('[data-charm-target="red:spellsword"]')).toBeAttached();
  await expect(page.locator('.mage-quick-states')).toContainText('Incantato');
  await cell(page, 'E7').click(); await expect(cell(page, 'E7').locator('.charm-status')).toBeVisible(); await expect(cell(page, 'E7')).toHaveAttribute('title', /Affascinato/);
  const chained = await cell(page, 'E7').locator('.charm-status [data-symbol="chained-heart"]').innerHTML();
  expect(chained).toBe(await cell(page, 'F6').locator('[data-emblem="enchanter"] [data-symbol="chained-heart"]').innerHTML());
  await settings(page); await page.getByLabel('Mostra aiuti e anteprime degli effetti').uncheck(); await closeMenu(page); await expect(cell(page, 'E7').locator('.charm-status')).toBeVisible();
  await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click(); await next(page); await expect(page.locator('.moving-piece .charm-status')).toBeVisible();
  await next(page); await expect(page.locator('.board-grid .charm-status')).toHaveCount(0); await page.getByRole('button', { name: 'Mostra esito' }).click();
});
test('entrare nell’influenza durante l’attivazione non mostra stati di fascino né blocca l’abilità', async ({ page }) => {
  const m = scenario(); put(m, 'red', 'spellsword', 4, 4); put(m, 'blue', 'enchanter', 6, 4);
  await open(page, m); await expect(cell(page, 'E6').locator('.charm-presence')).toHaveCount(0);
  await cell(page, 'E6').click(); await cell(page, 'F6').click();
  await expect(cell(page, 'F6').locator('.charm-presence')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Usa abilità', exact: true })).toBeEnabled();
  await expect(page.locator('[data-charm-target]')).toHaveCount(0);
  await expect(page.locator('.mage-quick-states')).toHaveCount(0);
  await expect(cell(page, 'F6')).not.toHaveAttribute('title', /Affascinato|Influenza/);
  await page.getByRole('button', { name: 'Dettagli', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.mage-condition-note')).toHaveCount(0);
  await page.getByRole('button', { name: 'Chiudi scheda mago' }).click();
  await settings(page); await page.getByLabel('Mostra aiuti e anteprime degli effetti').uncheck(); await closeMenu(page); await expect(cell(page, 'F6').locator('.charm-presence')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/charm-influence.png', fullPage: true });
});
test('le radici seguono un bersaglio teletrasportato e i due portali mostrano partenza e arrivo', async ({ page }) => {
  const m = scenario(); put(m, 'red', 'teleporter', 4, 4); put(m, 'blue', 'spellsword', 5, 4); wizard(m.game, 'blue:spellsword')!.restrainedUntil = 3;
  await open(page, m); await expect(cell(page, 'F6').locator('.terrain-roots')).toBeVisible(); await expect(cell(page, 'F6')).toHaveAttribute('title', /può agire ed essere spostato/);
  await expect(cell(page, 'F6').locator('.mage-restraint')).toHaveCount(0);
  const [earth, face, token] = await Promise.all([cell(page, 'F6').locator('.earth-prison').boundingBox(), cell(page, 'F6').locator('.mage-face').boundingBox(), cell(page, 'F6').locator('.mage-token').boundingBox()]);
  expect(earth!.y).toBeGreaterThan(face!.y + face!.height * .35); expect(earth!.y + earth!.height).toBeLessThanOrEqual(token!.y + token!.height + 1);
  await page.screenshot({ path: 'test-results/earth-prison.png', fullPage: true });
  await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click(); await cell(page, 'F6').click(); await cell(page, 'E7').click(); await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click();
  await next(page); await expect(page.locator('.portal-label')).toHaveText(['PARTENZA', 'ARRIVO']); await next(page);
  await expect(cell(page, 'E7').locator('.terrain-bound')).toBeVisible(); await expect(cell(page, 'F6').locator('.ghost-teleport')).toBeAttached(); await expect(page.locator('[data-moving-piece]')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/battle-teleport.png', fullPage: true }); await page.getByRole('button', { name: 'Mostra esito' }).click(); await expect(cell(page, 'E7').locator('.terrain-roots')).toBeVisible();
});
test('la copia fuori distanza perde il legame luminoso e lo recupera avvicinando il proprietario', async ({ page }) => {
  const m = scenario(); m.game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 6, y: 5 } }];
  await open(page, m); await expect(cell(page, 'G5').locator('.copy-dormant-status')).toBeVisible(); await expect(cell(page, 'G5').locator('.mage-hp')).toHaveCount(0); await expect(cell(page, 'G5')).toHaveAttribute('title', /fuori distanza/);
  await cell(page, 'G1').click(); await cell(page, 'G2').click(); await expect(cell(page, 'G5').locator('.copy-dormant-status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Azzera preparazione' }).click(); await expect(cell(page, 'G5').locator('.copy-dormant-status')).toBeVisible();
});
test('scarica simultanea: fulmini lungo le adiacenze e cuori spezzati sui due bersagli', async ({ page }) => {
  const m = scenario(); put(m, 'red', 'electromancer', 4, 4); put(m, 'red', 'geomancer', 5, 4); put(m, 'blue', 'spellsword', 6, 4);
  await open(page, m); await cast(page, 'E6'); await next(page); await expect(page.locator('.lightning-link')).toHaveCount(2); await next(page);
  await expect(page.locator('[data-cue-symbol="damage"]')).toHaveCount(2); await expect(page.locator('[data-cue-symbol="damage"] strong')).toHaveText(['−1', '−1']);
  await page.screenshot({ path: 'test-results/battle-lightning.png', fullPage: true });
});
test('fuoco e tocco psichico hanno segni propri e il fuoco mostra tutta la croce', async ({ page }) => {
  const m = scenario(); put(m, 'red', 'pyromancer', 4, 4); put(m, 'blue', 'spellsword', 6, 4);
  await open(page, m); await cast(page, 'E6', 'F6'); await next(page); await expect(page.locator('.fire-area')).toHaveCount(5); await expect(page.locator('.fire-flame')).toHaveCount(5); await page.screenshot({ path: 'test-results/battle-fireball.png', fullPage: true });
  await page.getByRole('button', { name: 'Mostra esito' }).click(); await matchMenu(page); await page.getByRole('button', { name: 'Esci dal gioco' }).click(); await page.getByRole('button', { name: 'Esci e torna all’inizio' }).click();
  const other = scenario(); put(other, 'red', 'enchanter', 4, 4); put(other, 'blue', 'spellsword', 5, 4);
  await open(page, other); await cast(page, 'E6', 'F6'); await next(page); await expect(page.locator('.psychic-ring')).toBeVisible();
});
test('audio facoltativo, volume persistente e modalità ridotta non modificano il gioco', async ({ page }) => {
  await page.addInitScript(() => { const original = AudioContext.prototype.createOscillator; (window as unknown as { soundEvents: number }).soundEvents = 0; AudioContext.prototype.createOscillator = function() { (window as unknown as { soundEvents: number }).soundEvents++; return original.call(this); }; });
  const m = scenario(); put(m, 'red', 'spellsword', 4, 4); put(m, 'blue', 'geomancer', 5, 4);
  await open(page, m); await settings(page); await expect(page.getByRole('button', { name: 'Attiva suoni' })).toHaveAttribute('aria-pressed', 'false');
  await settings(page); await page.getByRole('button', { name: 'Attiva suoni' }).click(); await page.getByLabel('Effetti e movimenti ridotti').check(); await closeMenu(page);
  await cast(page, 'E6', 'F6'); await next(page); await next(page); await expect.poll(() => page.evaluate(() => (window as unknown as { soundEvents: number }).soundEvents)).toBeGreaterThan(0);
  await expect(page.locator('.battle-overlay')).toHaveClass(/reduced-effects/);
  const animations = await page.locator('.battle-overlay').evaluate(el => el.getAnimations({ subtree: true }).length); expect(animations).toBe(0);
  await settings(page); await page.getByRole('button', { name: 'Disattiva suoni' }).click(); const sounds = await page.evaluate(() => (window as unknown as { soundEvents: number }).soundEvents);
  await page.getByLabel('Volume effetti').focus(); await page.keyboard.press('Home'); await closeMenu(page); await page.getByRole('button', { name: 'Mostra esito' }).click(); await page.getByRole('button', { name: 'Annulla attivazione', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { soundEvents: number }).soundEvents)).toBe(sounds);
  await page.reload(); await settings(page); await expect(page.getByLabel('Volume effetti')).toHaveValue('0'); await expect(page.getByLabel('Effetti e movimenti ridotti')).toBeChecked(); await expect(page.getByRole('button', { name: 'Attiva suoni' })).toBeVisible();
});
test('evocazione della copia, tragitto e attacco restano distinti e senza indicatori di vita', async ({ page }) => {
  const m = scenario(); put(m, 'red', 'illusionist', 4, 4); put(m, 'blue', 'spellsword', 6, 4);
  await open(page, m); await cell(page, 'E6').click(); await page.getByRole('button', { name: 'Usa abilità', exact: true }).click();
  await cell(page, 'F6').click(); await cell(page, 'F5').click(); await cell(page, 'G5').click(); await cell(page, 'G6').click(); await page.getByRole('button', { name: 'Concludi abilità' }).click(); await page.getByRole('button', { name: /^Conferma (attivazione|e passa turno|e concludi partita)/ }).click();
  await next(page); await expect(page.locator('[data-spell-effect="summon"]')).toBeVisible(); await next(page); await expect(cell(page, 'F6').locator('.summoning-copy')).toBeAttached();
  await expect(cell(page, 'F6').locator('.mage-hp')).toHaveCount(0); await next(page); await expect(page.locator('[data-moving-piece="copy:red:illusionist"]')).toBeVisible();
  await next(page); await next(page); await expect(page.locator('[data-cue-symbol="damage"] strong')).toHaveText('−1');
  await page.getByRole('button', { name: 'Mostra esito' }).click(); await expect(cell(page, 'G5').locator('.illusion-token')).toBeVisible(); await expect(cell(page, 'G5').locator('.mage-hp')).toHaveCount(0);
});
test('alla scadenza le radici si sgretolano e il movimento risulta ripristinato', async ({ page }) => {
  const m = scenario(); m.game.turn = 3; m.game.active = 'blue'; m.game.phase = 3; m.game.activity = true; m.game.activated = ['blue:geomancer', 'blue:pyromancer'];
  put(m, 'blue', 'spellsword', 5, 4); wizard(m.game, 'blue:spellsword')!.restrainedUntil = 3;
  await open(page, m); await expect(cell(page, 'F6').locator('.terrain-roots')).toBeVisible(); await page.getByRole('button', { name: 'Passa la mano' }).click();
  await expect(page.locator('[data-spell-effect="release"]')).toBeVisible(); await expect(cell(page, 'F6').locator('.terrain-roots')).toHaveCount(0); await expect(page.getByTestId('action-presentation')).toContainText('immobilizzazione terminata');
  await page.getByRole('button', { name: 'Mostra esito' }).click(); await expect(cell(page, 'F6')).not.toHaveAttribute('title', /Immobilizzato/);
});
