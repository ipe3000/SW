import { expect, test } from '@playwright/test';

test('servizio pubblico PeerJS: due browser sincronizzano una modifica', async ({ browser }) => {
  test.setTimeout(60000);
  const hostContext = await browser.newContext(); const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage(); const guest = await guestContext.newPage();
    await host.goto('/');
    await host.getByLabel('Come ti chiami?').fill('Prova Rosso');
    await host.getByRole('button', { name: 'Crea sessione', exact: true }).click();
    await expect(host.getByTestId('connection-state')).toHaveText('Invito pronto', { timeout: 25000 });
    const invite = await host.getByLabel('Invito per il posto Blu').inputValue();
    await guest.goto(invite);
    await guest.getByLabel('Come ti chiami?').fill('Prova Blu');
    await guest.getByRole('button', { name: 'Entra nella sessione' }).click();
    for (const page of [host, guest]) await expect(page.getByTestId('connection-state')).toHaveText('Sincronizzato', { timeout: 25000 });
    await expect(host.getByText('PeerServer Cloud pubblico', { exact: true })).toBeAttached();
    await host.locator('[data-square="E5"]').click();
    await host.getByRole('button', { name: 'Conferma spostamento' }).click();
    for (const page of [host, guest]) await expect(page.getByTestId('revision')).toHaveText('1');
    expect(await host.getByTestId('fingerprint').textContent()).toBe(await guest.getByTestId('fingerprint').textContent());
    await host.getByRole('button', { name: 'Annulla', exact: true }).click();
    for (const page of [host, guest]) await expect(page.getByTestId('revision')).toHaveText('2');
  } finally { await hostContext.close(); await guestContext.close(); }
});
