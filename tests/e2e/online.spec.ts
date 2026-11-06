import { expect, test, type Browser, type Page } from '@playwright/test';

async function connectPair(browser: Browser) {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage(); const guest = await guestContext.newPage();
  await host.goto('/?lab=1');
  await host.getByLabel('Come ti chiami?').fill('Ada');
  await host.getByRole('button', { name: 'Crea sessione', exact: true }).click();
  await expect(host.getByTestId('connection-state')).toHaveText('Invito pronto');
  const invite = await host.getByLabel('Invito per il posto Blu').inputValue();
  await guest.goto(invite);
  await guest.getByLabel('Come ti chiami?').fill('Bruno');
  await guest.getByRole('button', { name: 'Entra nella sessione' }).click();
  await ready(host, guest);
  return { host, guest, hostContext, guestContext, invite };
}
async function ready(...pages: Page[]) {
  for (const page of pages) await expect(page.getByTestId('connection-state')).toHaveText('Sincronizzato', { timeout: 20000 });
}
async function sameRevision(host: Page, guest: Page, count: number) {
  for (const page of [host, guest]) await expect(page.getByTestId('revision')).toHaveText(String(count));
  expect(await host.getByTestId('fingerprint').textContent()).toBe(await guest.getByTestId('fingerprint').textContent());
}
test('invito, anteprima privata, conferma, annullamento e passaggio del turno', async ({ browser }) => {
  const { host, guest, hostContext, guestContext } = await connectPair(browser);
  try {
    await host.locator('[data-square="E5"]').click();
    await sameRevision(host, guest, 0);
    await expect(guest.getByRole('button', { name: 'Conferma spostamento' })).toBeDisabled();
    await host.getByRole('button', { name: 'Conferma spostamento' }).click();
    await sameRevision(host, guest, 1);
    await expect(host.locator('[data-square="E5"] .piece.red')).toBeVisible();
    await expect(guest.locator('[data-square="E5"] .piece.red')).toBeVisible();
    await host.getByRole('button', { name: 'Annulla', exact: true }).click();
    await sameRevision(host, guest, 2);
    await expect(guest.locator('[data-square="E2"] .piece.red')).toBeVisible();
    await host.locator('[data-square="E4"]').click();
    await host.getByRole('button', { name: 'Conferma spostamento' }).click();
    await sameRevision(host, guest, 3);
    await host.getByRole('button', { name: 'Termina turno' }).click();
    await sameRevision(host, guest, 4);
    await guest.locator('[data-square="F8"]').click();
    await guest.getByRole('button', { name: 'Conferma spostamento' }).click();
    await sameRevision(host, guest, 5);
    await expect(host.locator('[data-square="F8"] .piece.blue')).toBeVisible();
    await expect(host.getByRole('button', { name: 'Annulla', exact: true })).toBeDisabled();
    await host.screenshot({ path: 'test-results/sessione-desktop.png', fullPage: true });
  } finally { await hostContext.close(); await guestContext.close(); }
});
test('interruzione del creatore e ricaricamento di entrambi conservano la cronologia', async ({ browser }) => {
  const { host, guest, hostContext, guestContext } = await connectPair(browser);
  try {
    await host.locator('[data-square="E5"]').click();
    await host.getByRole('button', { name: 'Conferma spostamento' }).click();
    await sameRevision(host, guest, 1);
    await host.getByRole('button', { name: 'Interrompi per prova' }).click();
    await expect(host.getByTestId('connection-state')).toHaveText('Sospeso');
    await expect(guest.getByRole('button', { name: 'Conferma spostamento' })).toBeDisabled();
    await host.getByRole('button', { name: 'Ricollega', exact: false }).click();
    await ready(host, guest);
    await sameRevision(host, guest, 1);
    await Promise.all([host.reload(), guest.reload()]);
    await ready(host, guest);
    await sameRevision(host, guest, 1);
    await expect(guest.locator('[data-square="E5"] .piece.red')).toBeVisible();
  } finally { await hostContext.close(); await guestContext.close(); }
});
test('backup personale importato in un nuovo browser riprende il posto originale', async ({ browser }, testInfo) => {
  const { host, guest, hostContext, guestContext } = await connectPair(browser);
  let replacementContext;
  try {
    await host.locator('[data-square="E5"]').click();
    await host.getByRole('button', { name: 'Conferma spostamento' }).click();
    await sameRevision(host, guest, 1);
    const downloadEvent = guest.waitForEvent('download');
    await guest.getByRole('button', { name: 'Esporta backup', exact: false }).click();
    const download = await downloadEvent;
    const path = testInfo.outputPath('backup-personale.json');
    await download.saveAs(path);
    await guestContext.close();
    replacementContext = await browser.newContext();
    const replacement = await replacementContext.newPage();
    await replacement.goto('/?lab=1');
    await replacement.getByTestId('import-backup').setInputFiles(path);
    await ready(host, replacement);
    await sameRevision(host, replacement, 1);
    await expect(replacement.locator('.board-player.own')).toContainText('Bruno');
  } finally { await hostContext.close(); await guestContext.close(); await replacementContext?.close(); }
});
test('un altro browser non può occupare il posto già assegnato', async ({ browser }) => {
  const { host, guest, hostContext, guestContext, invite } = await connectPair(browser);
  const strangerContext = await browser.newContext();
  try {
    await guestContext.close();
    await expect(host.getByTestId('connection-state')).toHaveText('In attesa del rientro', { timeout: 25000 });
    const stranger = await strangerContext.newPage();
    await stranger.goto(invite);
    await stranger.getByLabel('Come ti chiami?').fill('Altro ospite');
    await stranger.getByRole('button', { name: 'Entra nella sessione' }).click();
    await expect(stranger.getByRole('alert')).toContainText('già assegnato');
    await expect(stranger.getByRole('button', { name: 'Conferma spostamento' })).toBeDisabled();
  } finally { await hostContext.close(); await guestContext.close(); await strangerContext.close(); }
});
test('home utilizzabile su desktop e telefono, backup non valido senza sovrascritture', async ({ page }) => {
  await page.goto('/?lab=1');
  await page.getByTestId('import-backup').setInputFiles({ name: 'errato.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"altro"}') });
  await expect(page.getByRole('alert')).toContainText('Formato');
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Crea sessione', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/home-telefono.png', fullPage: true });
});
