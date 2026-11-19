import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { applyComputerCommand } from '../../src/ai/types';
import type { Campaign } from '../../src/ailab/model';

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
  for (const row of campaign.results) {
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
