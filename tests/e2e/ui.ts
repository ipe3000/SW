import type { Page } from '@playwright/test';

async function reveal(page: Page, selector: string) {
  const section = page.locator(selector);
  if (await section.count() && !await section.evaluate(el => (el as HTMLDetailsElement).open)) await section.locator(':scope > summary').click();
}
export const settings = (page: Page) => reveal(page, '.settings-menu');
export const matchMenu = (page: Page) => reveal(page, '.match-menu');
