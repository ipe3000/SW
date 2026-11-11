import { expect, type Page } from '@playwright/test';

export async function openComputerSettings(page: Page) {
  await page.getByRole('button', { name: 'Impostazioni AI' }).click();
  return page.getByRole('dialog', { name: 'Impostazioni AI' });
}

export async function changeComputerSpeed(page: Page, speed: string) {
  const dialog = await openComputerSettings(page);
  await dialog.getByRole('combobox', { name: 'Velocità di riproduzione' }).selectOption(speed);
  await dialog.getByRole('button', { name: 'Applica' }).click();
  await expect(dialog).toBeHidden();
}
