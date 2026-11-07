import { expect, test, type Browser, type Page } from '@playwright/test';
import { append, backupText, makeSession, replay } from '../../src/network/model';
import { defaultOptions, previewActivation, wizard, type Activation, type Match } from '../../src/engine/game';
import { didactic } from '../../src/ai/didactic';
import { square } from '../../src/engine/geometry';
import type { GameAction } from '../../src/engine/commands';

const cell = (p: Page, name: string) => p.locator(`[data-square="${name}"]`);
async function ready(...pages: Page[]) { for (const page of pages) await expect(page.getByTestId('connection-state')).toHaveText('Sincronizzato', { timeout: 30000 }); }
async function revision(host: Page, guest: Page, value: number) {
  for (const page of [host, guest]) await expect(page.getByTestId('revision')).toHaveText(String(value));
  expect(await host.getByTestId('fingerprint').textContent()).toBe(await guest.getByTestId('fingerprint').textContent());
}
async function pair(browser: Browser, custom = false, manual = false) {
  const a = await browser.newContext(), b = await browser.newContext();
  await a.addInitScript(() => localStorage.setItem('sw-presentation-mode', 'instant'));
  await b.addInitScript(mode => localStorage.setItem('sw-presentation-mode', mode), manual ? 'manual' : 'instant');
  const host = await a.newPage(), guest = await b.newPage();
  await host.goto('./'); await host.getByRole('link', { name: 'Gioca online con un amico' }).click();
  await host.getByLabel('Come ti chiami?').fill('Ada');
  if (custom) { await host.getByRole('combobox', { name: 'Schieramento', exact: true }).selectOption('custom'); await host.getByRole('combobox', { name: 'Muri di forza', exact: true }).selectOption('varied'); }
  await host.getByRole('button', { name: 'Crea duello e invito' }).click();
  await expect(host.getByTestId('connection-state')).toHaveText('Invito pronto', { timeout: 30000 });
  const invite = await host.getByLabel('Invito per il posto Blu').inputValue();
  await guest.goto(invite); await guest.getByLabel('Come ti chiami?').fill('Bruno'); await guest.getByRole('button', { name: 'Entra nel duello' }).click();
  await ready(host, guest); await revision(host, guest, 0);
  return { host, guest, a, b, invite };
}
test('gioco completo: campo condiviso, anteprima privata, percorso animato remoto, annullamento e cambio gilda', async ({ browser }) => {
  const { host, guest, a, b } = await pair(browser, false, true);
  try {
    const walls = await host.locator('.cell.wall').evaluateAll(cells => cells.map(c => c.getAttribute('data-square')).sort());
    expect(walls).toHaveLength(2);
    expect(walls).toEqual(await guest.locator('.cell.wall').evaluateAll(cells => cells.map(c => c.getAttribute('data-square')).sort()));
    await cell(host, 'B1').click(); await cell(host, 'B3').click();
    await revision(host, guest, 0); await expect(cell(guest, 'B1').locator('.mage-abbr')).toHaveText('ELE');
    await host.getByRole('button', { name: 'Conferma attivazione' }).click(); await revision(host, guest, 1);
    await expect(host.getByRole('button', { name: 'Termina turno' })).toBeDisabled();
    await guest.getByRole('button', { name: 'Prossimo evento' }).click();
    await expect(guest.locator('[data-moving-piece]')).toHaveAttribute('data-from', 'B1');
    await expect(guest.locator('[data-moving-piece]')).toHaveAttribute('data-to', 'B2');
    await guest.getByRole('button', { name: 'Prossimo evento' }).click();
    await expect(guest.locator('[data-moving-piece]')).toHaveAttribute('data-to', 'B3');
    await guest.getByRole('button', { name: 'Mostra esito' }).click();
    await expect(cell(guest, 'B3').locator('.mage-abbr')).toHaveText('ELE');
    await host.getByRole('button', { name: 'Annulla attivazione', exact: true }).click(); await revision(host, guest, 2);
    await expect(cell(guest, 'B1').locator('.mage-abbr')).toHaveText('ELE');
    await guest.getByLabel('Riproduzione delle azioni').selectOption('instant');
    await cell(host, 'B1').click(); await cell(host, 'B2').click(); await host.getByRole('button', { name: 'Conferma attivazione' }).click(); await revision(host, guest, 3);
    await host.getByRole('button', { name: 'Termina turno' }).click(); await revision(host, guest, 4);
    await expect(host.getByRole('button', { name: 'Annulla attivazione', exact: true })).toBeDisabled();
    await cell(guest, 'I10').click(); await cell(guest, 'I9').click(); await guest.getByRole('button', { name: 'Conferma attivazione' }).click(); await revision(host, guest, 5);
    await expect(cell(host, 'I9').locator('.mage-abbr')).toHaveText('ELE');
    await cell(guest, 'H10').click(); await cell(guest, 'H9').click(); await guest.getByRole('button', { name: 'Conferma attivazione' }).click(); await revision(host, guest, 6);
    await cell(guest, 'D10').click(); await cell(guest, 'D9').click(); await guest.getByRole('button', { name: 'Conferma semiattivazione' }).click(); await revision(host, guest, 7);
    await expect(host.locator('.game-heading h1')).toHaveText('Il turno di Ada.');
    for (const p of [host, guest]) await expect(p.getByRole('button', { name: 'Annulla attivazione', exact: true })).toBeDisabled();
    await Promise.all([host.reload(), guest.reload()]); await ready(host, guest); await revision(host, guest, 7);
    await guest.screenshot({ path: 'test-results/full-online-guest.png', fullPage: true });
  } finally { await a.close(); await b.close(); }
});
test('rientro e backup personale riprendono lo stesso posto e gli stessi annullamenti', async ({ browser }, info) => {
  const { host, guest, a, b } = await pair(browser); let replacement;
  try {
    await cell(host, 'B1').click(); await cell(host, 'B2').click(); await host.getByRole('button', { name: 'Conferma attivazione' }).click(); await revision(host, guest, 1);
    const downloaded = guest.waitForEvent('download'); await guest.getByRole('button', { name: 'Esporta backup personale' }).click(); const file = info.outputPath('guest.json'); await (await downloaded).saveAs(file);
    await host.getByRole('button', { name: 'Sospendi collegamento' }).click(); await expect(host.getByTestId('connection-state')).toHaveText('Sospeso');
    await expect(guest.getByRole('button', { name: 'Termina turno' })).toBeDisabled();
    await host.getByRole('button', { name: 'Ricollega', exact: true }).click(); await ready(host, guest);
    await Promise.all([host.reload(), guest.reload()]); await ready(host, guest); await revision(host, guest, 1);
    await host.getByRole('button', { name: 'Annulla attivazione', exact: true }).click(); await revision(host, guest, 2);
    await b.close(); replacement = await browser.newContext(); const fresh = await replacement.newPage(); await fresh.goto('./?online=1');
    await fresh.getByTestId('import-online').setInputFiles(file); await ready(host, fresh); await revision(host, fresh, 2);
    await expect(cell(fresh, 'B1').locator('.mage-abbr')).toHaveText('ELE');
  } finally { await a.close(); await b.close(); await replacement?.close(); }
});
test('schieramento personalizzato condiviso, turni di collocamento e gilde riservate', async ({ browser }) => {
  const { host, guest, a, b, invite } = await pair(browser, true); const extra = await browser.newContext();
  try {
    for (let i = 0; i < 4; i++) { await host.getByRole('button', { name: 'Schiera', exact: false }).first().click(); await cell(host, `${String.fromCharCode(66 + i)}1`).click(); await revision(host, guest, i + 1); }
    await expect(host.getByRole('button', { name: 'Annulla ultimo schieramento' })).toBeDisabled();
    await guest.getByRole('button', { name: 'Schiera', exact: false }).first().click(); await cell(guest, 'B10').click(); await revision(host, guest, 5);
    await guest.getByRole('button', { name: 'Annulla ultimo schieramento' }).click(); await revision(host, guest, 6);
    await expect(cell(host, 'B10').locator('.mage-token')).toHaveCount(0);
    const third = await extra.newPage(); await third.goto(invite); await third.getByRole('button', { name: 'Entra nel duello' }).click();
    await expect(third.getByRole('alert')).toContainText('assegnato', { timeout: 15000 });
    await expect(host.getByTestId('revision')).toHaveText('6');
  } finally { await a.close(); await b.close(); await extra.close(); }
});

/** Build the backup exclusively through legal commands from a fresh board. */
function decisiveFixture() {
  const host = makeSession('Ada', undefined, { ...defaultOptions, hp: 3 }), guest = makeSession('Bruno', host);
  host.guestCredential = guest.credential; host.remoteName = guest.name; guest.remoteName = host.name;
  for (let i = 0; i < 220; i++) {
    const before = replay(host.journal), decision = didactic.choose(before.game).command;
    const action: GameAction = decision.kind === 'place' ? { kind: 'place', wizardId: decision.wizardId, to: decision.position } : decision;
    const next = append(host.journal, { id: `fixture-${i}`, actor: before.game.active, at: '2026-11-07T12:00:00.000Z', action });
    if (replay(next).game.pending && action.kind === 'activate') { guest.journal = structuredClone(host.journal); return { host, guest, before, activation: action.activation }; }
    host.journal = next;
  }
  throw new Error('Partita di collaudo senza esito');
}
async function prepare(page: Page, match: Match, activation: Activation) {
  await cell(page, square(wizard(match.game, activation.wizardId)!.pos!)).click();
  await page.getByLabel('Modifica percorso passo per passo').check();
  for (const p of activation.before) await cell(page, square(p)).click();
  const atCast = previewActivation(match.game, { ...activation, spell: undefined, after: [] }, true).game, spell = activation.spell;
  if (spell) {
    await page.getByRole('button', { name: 'Usa abilità', exact: true }).click();
    if ('targetId' in spell && spell.kind !== 'illusion') await cell(page, square(wizard(atCast, spell.targetId)!.pos!)).click();
    if (spell.kind === 'fireball') await cell(page, square(spell.center)).click();
    if (spell.kind === 'teleport') await cell(page, square(spell.destination)).click();
    if (spell.kind === 'illusion') { if (spell.summon) await cell(page, square(spell.summon)).click(); for (const p of spell.path) await cell(page, square(p)).click(); if (spell.targetId) await cell(page, square(wizard(atCast, spell.targetId)!.pos!)).click(); await page.getByRole('button', { name: 'Concludi abilità' }).click(); }
    if (spell.kind === 'wind' && !(wizard(atCast, spell.targetId)!.side !== atCast.active && wizard(atCast, spell.targetId)!.hp === 1)) { for (const p of spell.path) await cell(page, square(p)).click(); await page.getByRole('button', { name: 'Concludi abilità' }).click(); }
  }
  for (const p of activation.after) await cell(page, square(p)).click();
  await page.getByRole('button', { name: 'Conferma attivazione' }).click();
}
test('abilità letale, risultato provvisorio, annullamento, riconnessione e conclusione definitiva', async ({ browser }) => {
  test.setTimeout(120000);
  const fixture = decisiveFixture(), n = fixture.host.journal.events.length;
  const a = await browser.newContext(), b = await browser.newContext();
  await a.addInitScript(() => localStorage.setItem('sw-presentation-mode', 'instant')); await b.addInitScript(() => localStorage.setItem('sw-presentation-mode', 'instant'));
  const host = await a.newPage(), guest = await b.newPage();
  try {
    await Promise.all([host.goto('./?online=1'), guest.goto('./?online=1')]);
    await host.getByTestId('import-online').setInputFiles({ name: 'host.json', mimeType: 'application/json', buffer: Buffer.from(backupText(fixture.host)) });
    await guest.getByTestId('import-online').setInputFiles({ name: 'guest.json', mimeType: 'application/json', buffer: Buffer.from(backupText(fixture.guest)) });
    await ready(host, guest); await revision(host, guest, n);
    const actor = fixture.before.game.active === 'red' ? host : guest, observer = actor === host ? guest : host;
    await observer.getByLabel('Riproduzione delle azioni').selectOption('manual');
    await prepare(actor, fixture.before, fixture.activation); await revision(host, guest, n + 1);
    await expect(observer.getByTestId('action-presentation')).toHaveAttribute('data-playing', 'true');
    await expect(actor.getByRole('button', { name: 'Termina turno' })).toBeDisabled();
    let sawDamage = false;
    for (let i = 0; i < 20 && !await observer.locator('[data-cue-symbol="skull"]').count(); i++) {
      if (await observer.locator('[data-cue-symbol="damage"]').count()) sawDamage = true;
      await observer.getByRole('button', { name: 'Prossimo evento' }).click();
    }
    expect(sawDamage).toBe(true); await expect(observer.locator('.battle-overlay .icon-skull').first()).toBeVisible();
    await observer.getByRole('button', { name: 'Mostra esito' }).click(); await expect(observer.locator('.notice.provisional')).toBeVisible();
    await actor.getByRole('button', { name: 'Annulla attivazione', exact: true }).click(); await revision(host, guest, n + 2); await expect(observer.locator('.notice.provisional')).toHaveCount(0);
    await prepare(actor, fixture.before, fixture.activation); await revision(host, guest, n + 3); await observer.getByRole('button', { name: 'Mostra esito' }).click();
    await Promise.all([host.reload(), guest.reload()]); await ready(host, guest); await revision(host, guest, n + 3);
    for (const p of [host, guest]) await expect(p.locator('.notice.provisional')).toBeVisible();
    await actor.getByRole('button', { name: 'Termina turno' }).click(); await revision(host, guest, n + 4);
    for (const p of [host, guest]) {
      await expect(p.getByRole('dialog')).toBeVisible(); await expect(p.getByRole('dialog')).toContainText('L’esito è definitivo');
      await p.getByRole('button', { name: 'Osserva il campo' }).click(); await expect(p.locator('.game-heading h1')).toContainText('Vittoria');
    }
  } finally { await a.close(); await b.close(); }
});
