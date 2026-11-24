import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { applyComputerCommand } from '../../src/ai/types';
import type { Campaign } from '../../src/ailab/model';

test('clears campaigns saved before the AI #2 reset', async ({ page }) => {
  await page.route('**/ailab/legacy-storage', route => route.fulfill({ contentType: 'text/html', body: '<title>Legacy storage</title>' }));
  await page.goto('ailab/legacy-storage');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('strategic-wizardry-ailab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('campaigns');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('campaigns', 'readwrite');
      tx.objectStore('campaigns').put({ schema: 1, id: 'legacy-test' }, 'latest');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
  await page.goto('ailab/');
  await expect(page.locator('.lab-status')).toHaveText('Pronto');
  await expect(page.getByRole('button', { name: 'Scarica archivio JSON' })).toBeDisabled();
  expect(await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('strategic-wizardry-ailab', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const count = db.transaction('campaigns').objectStore('campaigns').count();
      count.onsuccess = () => { db.close(); resolve(count.result); };
      count.onerror = () => { db.close(); reject(count.error); };
    };
  }))).toBe(0);
});

test('direct hidden page runs compiled workers and exports replayable results', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('ailab');
  await expect(page).toHaveTitle('ailab · Strategic Wizardry');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  await page.getByRole('combobox', { name: 'Confronto', exact: true }).selectOption('pair');
  await page.getByRole('combobox', { name: 'AI 1', exact: true }).selectOption('easy');
  await page.getByRole('combobox', { name: 'AI 2', exact: true }).selectOption('normal');
  await page.getByLabel('Campi per confronto', { exact: true }).fill('1');
  await page.getByLabel('Limite comandi per partita').fill('2');
  const lightning = page.getByRole('checkbox', { name: 'Elettromante senza fuoco amico' });
  const spellsword = page.getByRole('checkbox', { name: 'Lamarcana: movimento di 3 caselle' });
  await expect(lightning).not.toBeChecked();
  await expect(spellsword).not.toBeChecked();
  await lightning.check();
  await spellsword.check();
  await page.getByRole('button', { name: 'Nuova campagna' }).click();
  await expect(page.locator('.lab-status')).toHaveText('Completata');
  await expect(page.getByRole('table', { name: 'Partite completate' }).locator('tbody tr')).toHaveCount(2);
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica archivio JSON' }).click();
  const download = await jsonDownload;
  const campaign: Campaign = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(campaign.results).toHaveLength(2);
  expect(campaign.build).toMatch(/^[a-f0-9]{16}$/);
  expect(campaign.sampling).toBe('distinct-v2');
  const variants = { safeLightning: true, shorterSpellswordMove: true };
  expect(campaign.config).toMatchObject(variants);
  for (const row of campaign.results) {
    expect(row.test).toMatchObject(variants);
    expect(row.final.options).toMatchObject(variants);
    expect(row.outcome).toBe('limit'); expect(row.steps).toHaveLength(2);
    for (let index = 0; index < row.steps.length; index++) {
      const applied = applyComputerCommand(row.steps[index].before, row.steps[index].command);
      const expected = row.steps[index + 1]?.before ?? row.final;
      expect(applied.wizards).toEqual(expected.wizards);
      expect(applied.active).toBe(expected.active);
      expect(applied.turn).toBe(expected.turn);
    }
  }
  const mdDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica report Markdown' }).click();
  expect(await readFile((await (await mdDownload).path())!, 'utf8')).toContain('Richiesta per Codex');
  await page.reload();
  await expect(page.getByRole('table', { name: 'Partite completate' }).locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.lab-status')).toHaveText('Completata');
  await page.screenshot({ path: 'output/ailab-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/ailab-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.goto('./');
  await expect(page.locator('a[href*="ailab"]')).toHaveCount(0);
});

test('same-level campaign tests all three difficulties and exports initiative statistics',async({page})=>{
 await page.goto('ailab/');
 await page.getByRole('combobox',{name:'Confronto',exact:true}).selectOption('self');
 await page.getByLabel('Campi per confronto',{exact:true}).fill('1');
 await page.getByLabel('Limite comandi per partita').fill('1');
 await page.getByRole('button',{name:'Nuova campagna'}).click();
 await expect(page.locator('.lab-status')).toHaveText('Completata',{timeout:30000});
 await expect(page.getByRole('table',{name:'Partite completate'}).locator('tbody tr')).toHaveCount(3);
 await expect(page.getByRole('table',{name:'Iniziativa a parità di livello'}).locator('tbody tr')).toHaveCount(3);
 const exported=page.waitForEvent('download');await page.getByRole('button',{name:'Scarica archivio JSON'}).click();
 const archive:Campaign=JSON.parse(await readFile((await (await exported).path())!,'utf8'));
 expect(archive.config.mode).toBe('self');expect(archive.cases).toHaveLength(3);
 expect(archive.cases.every(test=>test.red===test.blue)).toBe(true);
 expect(new Set(archive.cases.map(test=>test.red))).toEqual(new Set(['easy','normal','hard']));
 const hard=archive.results.find(row=>row.test.red==='hard')!;
 expect(hard.steps[0].diagnostics?.openingTimeScale).toBe(.85);
 expect(hard.steps[0].diagnostics?.budgetMilliseconds).toBe(2720);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('pause terminates the worker and reload can resume the campaign', async ({ page }) => {
  await page.goto('ailab/');
  await page.getByRole('combobox', { name: 'Confronto', exact: true }).selectOption('pair');
  await page.getByLabel('Campi per confronto', { exact: true }).fill('1');
  await page.getByLabel('Limite comandi per partita').fill('2');
  await page.getByRole('button', { name: 'Nuova campagna' }).click();
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  await expect(page.locator('.lab-status')).toHaveText('In pausa');
  await page.reload();
  await expect(page.locator('.lab-status')).toHaveText('In pausa');
  await page.getByRole('button', { name: 'Riprendi', exact: true }).click();
  await expect(page.locator('.lab-status')).toHaveText('Completata', { timeout: 35000 });
  await expect(page.getByRole('table', { name: 'Partite completate' }).locator('tbody tr')).toHaveCount(2);
  const exported=page.waitForEvent('download');
  await page.getByRole('button',{name:'Scarica archivio JSON'}).click();
  const archive: Campaign=JSON.parse(await readFile((await (await exported).path())!,'utf8'));
  expect(archive.results.flatMap(row=>row.steps.filter(step=>row.test[step.before.active]==='hard'))).not.toHaveLength(0);
  for(const row of archive.results) for(const step of row.steps) if(row.test[step.before.active]==='hard') {
    expect(step.diagnostics).toBeDefined();
    expect(step.diagnostics!.rootCandidates).toBeGreaterThan(0);
    expect(step.auditMilliseconds).toBeGreaterThanOrEqual(0);
  }
});

test('AutoTune restores its own checkpoint and exports a fixed-rules paired campaign', async ({ page }) => {
  await page.route('**/assets/autotune-worker-*.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `let matches = 0;
      self.onmessage = () => {
        if (matches++) return;
        const stats = { decisions: 1, milliseconds: 10, maxMs: 10, evaluated: 10, timedOut: 0, nodesExhausted: 0, fallbacks: 0 };
        self.postMessage({ kind: 'result', summary: { outcome: 'red', commands: 2, elapsed: 20, stats: { red: stats, blue: stats } } });
      };`,
  }));
  await page.goto('ailab/');
  await page.getByRole('button', { name: 'AutoTune', exact: true }).click();
  await expect(page.getByText(/Difficile · schieramento standard · 4 PV · 2 muri standard/)).toBeVisible();
  await expect(page.getByLabel('Modalità di ricerca')).toHaveValue('p3');
  await expect(page.getByLabel('Muro in riga 6')).toHaveValue('F');
  await expect(page.getByLabel('Muro in riga 5')).toHaveValue('C');
  await page.getByLabel('Modalità di ricerca').selectOption('multi');
  await page.getByRole('button', { name: 'Avvia AutoTune' }).click();
  await expect(page.getByRole('status')).toContainText('1 / 96 partite');
  await page.getByRole('button', { name: 'Pausa AutoTune' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Riprendi AutoTune' })).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('1 / 96 partite');
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica report AutoTune' }).click();
  const archive = JSON.parse(await readFile((await (await exported).path())!, 'utf8'));
  expect(archive.rules).toMatchObject({ level: 'hard', hp: 4, walls: 'standard', placement: 'standard' });
  expect(archive.fields.validation).toHaveLength(12);
  expect(archive.results).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Scarica profilo validato' })).toHaveCount(0);
  await page.unroute('**/assets/autotune-worker-*.js');
  await page.getByRole('button', { name: 'Riprendi AutoTune' }).click();
  await expect(page.getByRole('status')).toContainText(/candidato blu.*[1-9]\d* comandi/, { timeout: 15000 });
  await page.getByRole('button', { name: 'Pausa AutoTune' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Campagne', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configura la campagna' })).toBeVisible();
});

test('AutoTune Campo singolo queues two color swaps and stops without validation', async ({ page }) => {
  await page.route('**/assets/autotune-worker-*.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `self.onmessage = ({ data }) => self.postMessage({ kind: 'result', summary: {
      outcome: data.candidateSide, commands: 1, elapsed: 1, stats: { red: {}, blue: {} }
    } });`,
  }));
  await page.goto('ailab/?mode=autotune');
  await expect(page.getByLabel('Modalità di ricerca')).toHaveValue('p3');
  await expect(page.getByText(/2 partite su F6–C5/)).toBeVisible();
  await page.getByRole('button', { name: 'Avvia AutoTune' }).click();
  await expect(page.getByRole('status')).toHaveText('Confronto completato su F6–C5.');
  await expect(page.getByText('P3 da rosso · vittoria')).toBeVisible();
  await expect(page.getByText('P3 da blu · vittoria')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scarica profilo validato' })).toHaveCount(0);
});

test('AutoTune prepares a winning profile with the exact weights from the completed batch', async ({ page }) => {
  await page.route('**/assets/autotune-worker-*.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `self.onmessage = ({ data }) => self.postMessage({ kind: 'result', summary: {
      outcome: data.profile.id === 'P2' ? data.candidateSide : 'red',
      commands: 1, elapsed: 1, stats: { red: {}, blue: {} }
    } });`,
  }));
  await page.goto('ailab/?mode=autotune');
  await page.getByLabel('Modalità di ricerca').selectOption('tune');
  await expect(page.getByLabel('Profilo di riferimento')).toHaveValue('g8-c3');
  await page.getByLabel('Profilo di riferimento').selectOption('ai2');
  await page.getByLabel('Seme dei profili').fill('502');
  await page.getByRole('button', { name: 'Avvia AutoTune' }).click();
  await page.getByRole('button', { name: 'Prepara verifica di P2' }).click();
  await expect(page.getByRole('status')).toHaveText('Confronto completato su F6–C5.');
  await expect(page.getByText(/2 partite su F6–C5/)).toBeVisible();
  await page.getByRole('button', { name: 'Avvia verifica di P2' }).click();
  await expect(page.getByRole('status')).toHaveText('Confronto completato su F6–C5.');
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica report AutoTune' }).click();
  const report = JSON.parse(await readFile((await (await exported).path())!, 'utf8'));
  expect(report.config.fixed.source).toBeTruthy();
  expect(report.config.reference).toBe('ai2');
  expect(report.profiles).toEqual([{ id: 'P2', values: {
    initiative: 0.9981, reinforcements: 0.9474, opening: 1.0133, danger: 0.9241, area: 0.9612,
  } }]);
  expect(report.results.map(row => row.candidateSide)).toEqual(['red', 'blue']);
});

test('continuous search resumes a pair, promotes automatically and applies the profile only on request', async ({ page }) => {
  let pauseDuringPair = true;
  await page.route('**/assets/autotune-worker-*.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `let games = 0;
      self.onmessage = ({ data }) => {
        if (${pauseDuringPair} && games++ > 0) return;
        self.postMessage({ kind: 'result', summary: {
          outcome: data.profile.id === 'G1-C1' ? data.candidateSide : 'red',
          commands: 1, elapsed: 1, stats: { red: {}, blue: {} }
        } });
      };`,
  }));
  await page.goto('ailab/?mode=continuous');
  await expect(page.getByLabel('Muro in riga 6')).toHaveValue('F');
  await expect(page.getByLabel('Muro in riga 5')).toHaveValue('C');
  await page.getByLabel('Giri per sessione').fill('1');
  await page.getByRole('button', { name: 'Avvia ricerca continua' }).click();
  await expect(page.getByRole('status')).toContainText('G1-C1 da blu');
  await page.getByRole('button', { name: 'Pausa ricerca' }).click();
  pauseDuringPair = false;
  await page.reload();
  await expect(page.getByRole('status')).toContainText('G1-C1 da blu');
  await page.getByRole('button', { name: 'Riprendi ricerca' }).click();
  await expect(page.getByRole('status')).toContainText('Limite di giri raggiunto');
  await expect(page.getByRole('table', { name: 'Giri della ricerca continua' }).locator('tbody tr')).toContainText('G1-C1');
  await expect(page.getByRole('button', { name: 'Ripristina G8-C3' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Applica a Difficile su F6–C5' }).click();
  await expect(page.getByText(/Nel gioco è attivo G1-C1/)).toBeVisible();
  await page.getByRole('button', { name: 'Ripristina G8-C3' }).click();
  await expect(page.getByText(/Nel gioco è attivo G1-C1/)).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Elettromante runs a paired experiment and exports role-specific telemetry', async ({ page }) => {
  await page.route('**/assets/autotune-worker-*.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `self.onmessage = ({ data }) => {
      const stats = { main: 8, extra: 3, electromancerMain: 1, electromancerExtra: 0, casts: 1,
        enemyDamage: 1, allyDamage: 0, enemyKills: 0, allyKills: 0 };
      const lightning = { red: stats, blue: stats };
      lightning[data.candidateSide] = { ...stats, casts: 3, enemyDamage: 6 };
      self.postMessage({ kind: 'result', summary: { outcome: data.candidateSide, commands: 1, elapsed: 1,
        stats: { red: {}, blue: {} }, lightning } });
    };`,
  }));
  await page.goto('ailab/');
  await page.getByRole('button', { name: 'Elettromante', exact: true }).click();
  await expect(page.getByLabel('Tipo di incentivo')).toHaveValue('impact');
  await expect(page.getByLabel('Bonus Elettromante (%)')).toHaveValue('30');
  await page.getByLabel('Campi per confronto').fill('1');
  await page.getByRole('button', { name: 'Avvia esperimento' }).click();
  await expect(page.getByRole('status')).toHaveText('Esperimento Elettromante completato.');
  await expect(page.getByText('2 vittorie · 0 sconfitte · 0 inconcluse')).toBeVisible();
  await expect(page.getByRole('row', { name: /Scariche a catena/ })).toContainText('6');
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica report Elettromante' }).click();
  const run = JSON.parse(await readFile((await (await exported).path())!, 'utf8'));
  expect(run.config.lightning).toEqual({ fields: 1, bonus: 30, sample: 'pilot', mode: 'impact' });
  expect(run.results.map(row => row.candidateSide)).toEqual(['red', 'blue']);
  expect(run.lightningResults).toMatchObject({ candidate: { casts: 6 }, reference: { casts: 2 } });
  await page.getByRole('button', { name: 'AutoTune', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Scarica report AutoTune' })).toBeDisabled();
});
