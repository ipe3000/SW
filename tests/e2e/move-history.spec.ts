import { expect, test, type Page } from '@playwright/test';
import { type GameAction, applyGameAction } from '../../src/engine/commands';
import { defaultOptions, newMatch, wizard, type Match } from '../../src/engine/game';
import { recordMove } from '../../src/engine/move-history';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const cell = (page: Page, square: string) => page.locator(`[data-square="${square}"]`);
const position = (page: Page) => page.getByRole('region', { name: 'Cronologia delle mosse' }).getByRole('status');
const latest = 'Torna all’ultima mossa';

type TestWorker = { onmessage: (event: MessageEvent) => void };
type TestWindow = Window & { scheduledWorkers: TestWorker[] };
const scheduledMove = {
  install: (page: Page) => page.addInitScript(() => {
    const testWindow = window as TestWindow;
    testWindow.scheduledWorkers = [];
    window.Worker = class {
      constructor() { testWindow.scheduledWorkers.push(this as unknown as TestWorker); }
      postMessage() {}
      terminate() {}
    } as unknown as typeof Worker;
  }),
  requests: (page: Page) => page.evaluate(() => (window as TestWindow).scheduledWorkers.length),
  reply: (page: Page, index: number, wizardId: string, point: { x: number; y: number }) => page.evaluate(({ index, wizardId, point }) => {
    (window as TestWindow).scheduledWorkers[index].onmessage(new MessageEvent('message', { data: {
      decision: { command: { kind: 'activate', activation: { wizardId, before: [point], after: [] } }, evaluated: 1 },
    } }));
  }, { index, wizardId, point }),
};

async function savedMatches(page: Page): Promise<Match[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('strategic-wizardry-local', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, rows = db.transaction('games').objectStore('games').getAll();
      rows.onsuccess = () => { db.close(); resolve(rows.result.map(row => row.match)); };
      rows.onerror = () => { db.close(); reject(rows.error); };
    };
  }));
}

async function move(page: Page, from: string, to: string) {
  await cell(page, from).click();
  await cell(page, to).click();
  await page.locator('.board-confirm').click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sw-presentation-mode', 'instant');
    let draws = 0;
    Math.random = () => { document.documentElement.dataset.randomDraws = String(++draws); return .3; };
  });
});

test('Contro il computer, consultazione, annullamento e salvataggio atomico della mossa alternativa', async ({ page }) => {
  await page.goto('./');
  await button(page, 'Gioca').click();
  await page.getByRole('radio', { name: 'Contro il computer', exact: true }).check();
  await page.getByRole('button', { name: /^Gioca contro il computer/ }).click();
  await button(page, 'Pausa duello').click();
  await expect(position(page)).toHaveText('Mossa 0 di 0 · Tocca al Rosso');
  await expect(button(page, 'Rivedi la tua ultima mossa')).toBeDisabled();
  for (const name of ['Mossa precedente', 'Mossa successiva', latest]) await expect(button(page, name)).toBeDisabled();
  await button(page, 'Riprendi duello').click();
  await move(page, 'F1', 'F2');
  await expect(page.getByRole('heading', { name: 'Il turno di Computer didattico.' })).toBeVisible();
  await expect(page.getByTestId('computer-state')).toHaveText('Tocca a te', { timeout: 20000 });
  await button(page, 'Pausa duello').click();
  const [before] = await savedMatches(page);
  const count = before.moveHistory!.length - 1;
  const draws = await page.locator('html').getAttribute('data-random-draws');
  const walls = await page.locator('.board-grid .wall').evaluateAll(items => items.map(item => item.getAttribute('data-square')));
  await button(page, 'Mossa precedente').click();
  await expect(position(page)).toHaveText(`Mossa ${count - 1} di ${count} · Tocca al Blu`);
  await expect(button(page, 'Cambia la tua mossa')).toHaveCount(0);
  await button(page, 'Mossa successiva').click();
  await expect(button(page, 'Mossa successiva')).toBeDisabled();
  await button(page, 'Rivedi la tua ultima mossa').click();
  await expect(position(page)).toHaveText(`Mossa 0 di ${count} · Tocca al Rosso`);
  await expect(cell(page, 'F1')).toHaveAttribute('data-wizard-id', 'red:aeromancer');
  await expect(button(page, 'Mossa precedente')).toBeDisabled();
  expect(await page.locator('.board-grid .wall').evaluateAll(items => items.map(item => item.getAttribute('data-square')))).toEqual(walls);
  if (draws) await expect(page.locator('html')).toHaveAttribute('data-random-draws', draws);

  async function prepare() {
    await button(page, 'Cambia la tua mossa').click();
    await move(page, 'D1', 'D2');
    await expect(page.getByRole('dialog', { name: 'Conferma mossa' })).toContainText(`Questa mossa sostituirà le ${count} mosse successive.`);
  }
  await prepare();
  await button(page, 'Torna alla preparazione').click();
  await button(page, 'Annulla modifica').click();
  expect(await savedMatches(page)).toEqual([before]);

  await page.evaluate(() => {
    const actual = IDBObjectStore.prototype.put;
    Object.assign(window, { originalGamePut: actual });
    IDBObjectStore.prototype.put = function (value, ...keys) {
      if (this.name === 'games') throw new DOMException('Test quota', 'QuotaExceededError');
      return actual.call(this, value, ...keys);
    };
  });
  await prepare();
  await button(page, 'Applica mossa').click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Salvataggio non riuscito');
  expect(await savedMatches(page)).toEqual([before]);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (window as Window & { originalGamePut: typeof IDBObjectStore.prototype.put }).originalGamePut;
  });
  await button(page, 'Applica mossa').click();
  await expect(position(page)).toHaveText('Mossa 1 di 1 · Tocca al Blu');
  await expect(cell(page, 'D2')).toHaveAttribute('data-wizard-id', 'red:pyromancer');
  const [changed] = await savedMatches(page);
  expect(changed.game.id).toBe(before.game.id);
  expect(changed.game.dice).toEqual(before.game.dice);
  expect(changed.moveHistory?.[0]).toEqual(before.moveHistory?.[0]);
  await button(page, 'Mossa precedente').click();
  await button(page, latest).click();
  await expect(position(page)).toHaveText('Mossa 1 di 1 · Tocca al Blu');
  await button(page, 'Mossa precedente').click();
  await button(page, 'Torna al presente e riprendi').click();
  await expect(page.getByTestId('computer-state')).toHaveText('Tocca a te', { timeout: 20000 });
  await expect(cell(page, 'D2')).toHaveAttribute('data-wizard-id', 'red:pyromancer');
});

test('Computer vs Computer scarta un calcolo in ritardo e applica una sola mossa manuale per conferma', async ({ page }) => {
  await scheduledMove.install(page);
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('./');
  await button(page, 'Gioca').click();
  await page.getByRole('radio', { name: 'Computer vs Computer', exact: true }).check();
  await page.getByRole('button', { name: /^Avvia Computer vs Computer/ }).click();
  await expect(page.getByTestId('computer-state')).toHaveText('Il computer sta scegliendo…');
  await button(page, 'Pausa duello').click();
  await scheduledMove.reply(page, 0, 'red:aeromancer', { x: 5, y: 8 });
  await expect(position(page)).toHaveText('Mossa 0 di 0 · Tocca al Rosso');
  await button(page, 'Gioca per Computer Rosso').click();
  await move(page, 'D1', 'D2');
  await button(page, 'Applica mossa').click();
  await expect(position(page)).toHaveText('Mossa 1 di 1 · Tocca al Blu · Mossa manuale');
  await expect(page.locator('.board-confirm')).toHaveCount(0);
  const [paused] = await savedMatches(page);
  expect(paused.moveHistory?.[1]).toMatchObject({ actor: 'red', manual: true });
  await button(page, 'Mossa precedente').click();
  await button(page, 'Mossa successiva').click();
  expect(await scheduledMove.requests(page)).toBe(1);
  expect(await savedMatches(page)).toEqual([paused]);

  await page.reload();
  await expect(position(page)).toHaveText('Mossa 1 di 1 · Tocca al Blu · Mossa manuale');
  expect(await scheduledMove.requests(page)).toBe(0);
  await button(page, 'Riprendi duello').click();
  await expect.poll(() => scheduledMove.requests(page)).toBe(1);
  await scheduledMove.reply(page, 0, 'blue:aeromancer', { x: 4, y: 1 });
  await expect(cell(page, 'E9')).toHaveAttribute('data-wizard-id', 'blue:aeromancer');
  await button(page, 'Pausa duello').click();
  await button(page, 'Mossa precedente').click();
  await button(page, 'Mossa precedente').click();
  await button(page, 'Gioca per Computer Rosso').click();
  await move(page, 'F1', 'F2');
  await expect(page.getByRole('dialog')).toContainText('Questa mossa sostituirà le 2 mosse successive.');
  await button(page, 'Applica mossa').click();
  await expect(position(page)).toHaveText('Mossa 1 di 1 · Tocca al Blu · Mossa manuale');
  await expect(cell(page, 'F2')).toHaveAttribute('data-wizard-id', 'red:aeromancer');
  await expect(cell(page, 'E10')).toHaveAttribute('data-wizard-id', 'blue:aeromancer');
  await expect(page.locator('.move-history')).toBeVisible();
  expect(await page.locator('.move-history').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});

for (const side of ['blue', 'both'] as const) test(`risultato e riepilogo aggiornati con lo stesso ID (${side})`, async ({ page }) => {
  const initial = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  initial.computer = { profile: 'didactic-v1', side };
  wizard(initial.game, 'red:spellsword')!.pos = { x: 4, y: 4 };
  wizard(initial.game, 'blue:spellsword')!.pos = { x: 5, y: 4 };
  wizard(initial.game, 'blue:spellsword')!.hp = 2;
  initial.game.wizards = initial.game.wizards.filter(w => w.side === 'red' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
  const win: GameAction = { kind: 'activate', finishTurn: true, activation: {
    wizardId: 'red:spellsword', before: [], after: [], spell: { kind: 'sword', targetId: 'blue:spellsword' },
  } };
  const original = recordMove(initial, applyGameAction(initial, win));
  await page.goto('./');
  await page.getByTestId('import-game').setInputFiles({ name: 'finished.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original)) });
  await expect(page.getByRole('dialog')).toBeVisible();
  await button(page, 'Rivedi le mosse').click();
  await expect(position(page)).toContainText('Vittoria del Rosso');
  const [finished] = await savedMatches(page);
  const edit = () => button(page, side === 'both' ? 'Gioca per Gilda Rossa' : 'Cambia la tua mossa').click();
  await button(page, 'Mossa precedente').click();
  await edit();
  await button(page, 'Annulla modifica').click();
  expect(await savedMatches(page)).toEqual([finished]);
  await edit();
  await move(page, 'F1', 'F2');
  await button(page, 'Applica mossa').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(position(page)).toContainText('Tocca al Blu');
  let matches = await savedMatches(page);
  expect(matches.map(match => match.game.id)).toEqual([initial.game.id]);
  expect(matches.filter(match => match.game.result)).toHaveLength(0);

  await button(page, 'Mossa precedente').click();
  await edit();
  await cell(page, 'E6').click();
  await button(page, 'Usa abilità').click();
  await cell(page, 'F6').click();
  await button(page, 'Conferma e concludi partita').click();
  await button(page, 'Applica mossa').click();
  await expect(page.getByRole('dialog')).toContainText(side === 'both' ? 'Vittoria della Gilda Rossa' : 'Hai vinto!');
  matches = await savedMatches(page);
  expect(matches.filter(match => match.game.result).map(match => match.game.id)).toEqual([initial.game.id]);
  expect(matches[0].recap).toEqual(original.recap);
});
