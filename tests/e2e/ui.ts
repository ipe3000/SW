import type { Page } from '@playwright/test';

async function reveal(page: Page, selector: string) {
  const section = page.locator(selector);
  if (await section.count() && !await section.evaluate(el => (el as HTMLDetailsElement).open)) await section.locator(':scope > summary').click();
}
export async function settings(page: Page) { if (await page.locator('.game-grid').count()) await matchMenu(page); }
export const setupOptions = (page: Page) => reveal(page, '.setup-options');
export async function matchMenu(page: Page) { if (!await page.locator('.match-menu').isVisible()) await page.getByRole('button', { name: 'Menù', exact: true }).click(); }

export async function closeMenu(page: Page) { if (await page.getByRole('dialog', { name: 'Menù', exact: true }).isVisible()) await page.getByRole('button', { name: 'Chiudi menù' }).click(); }
export async function openRules(page: Page) { await matchMenu(page); await page.getByRole('button', { name: 'Regole del gioco', exact: true }).click(); }
