import type { Page } from '@playwright/test';

async function reveal(page: Page, selector: string) {
  const section = page.locator(selector);
  if (await section.count() && !await section.evaluate(el => (el as HTMLDetailsElement).open)) await section.locator(':scope > summary').click();
}
export async function settings(page: Page) { if (await page.locator('.game-grid').count()) await matchMenu(page, 'Impostazioni'); }
export const setupOptions = (page: Page) => reveal(page, '.setup-options');
export async function matchMenu(page: Page, section?: string) {
  const dialog = page.locator('.match-menu');
  if (!await dialog.isVisible()) await page.getByRole('button', { name: 'Menù', exact: true }).click();
  if (!section || await dialog.getByRole('heading', { name: section, exact: true }).count()) return;
  const back = dialog.getByRole('button', { name: 'Indietro', exact: true });
  if (await back.isVisible()) await back.click();
  await dialog.getByRole('button', { name: section, exact: true }).click();
}

export async function closeMenu(page: Page) { if (await page.locator('.match-menu').isVisible()) await page.getByRole('button', { name: 'Torna alla partita', exact: true }).click(); }
export async function openRules(page: Page) { if (await page.getByRole('button', { name: 'Regole', exact: true }).count()) await page.getByRole('button', { name: 'Regole', exact: true }).click(); else { await matchMenu(page); await page.getByRole('button', { name: 'Regole e simboli', exact: true }).click(); } }
