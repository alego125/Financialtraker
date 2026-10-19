// Browser regression helper: accepts a Playwright Page; uses only synthetic local data.
export async function checkCalculatorModal(page, baseURL = 'http://127.0.0.1:55441') {
  if (!['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Use a local preview');
  await page.unrouteAll({ behavior: 'wait' });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/auth/me') ? { id: 'qa', name: 'QA', csrfToken: 'qa' }
      : path.endsWith('/dashboard') ? { kpis: {}, charts: {} }
      : path.endsWith('/transactions') ? { data: [], pagination: { pages: 0 } } : [];
    return route.fulfill({ json });
  });
  const results = [];
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseURL);
    await page.getByRole('button', { name: 'Nuevo movimiento', exact: true }).click();
    const transaction = page.getByRole('dialog', { name: 'Nueva Transacción', exact: true });
    const trigger = transaction.getByRole('button', { name: 'Abrir calculadora', exact: true });
    if (!await trigger.locator('svg').count()) throw new Error('Missing calculator icon');
    if ((await trigger.innerText()).trim() !== 'Calculadora') throw new Error('Missing visible label');
    await trigger.click();
    let calculator = page.getByRole('dialog', { name: 'Calculadora', exact: true });
    await calculator.waitFor();
    if (await calculator.evaluate(el => !!el.closest('[inert]'))) throw new Error('Calculator inherited inert');
    for (const key of ['7', '×', '8', '+', '2']) await calculator.getByRole('button', { name: key, exact: true }).click();
    await calculator.getByRole('button', { name: 'Usar este resultado', exact: true }).click();
    if (await transaction.locator('input[type=number]').inputValue() !== '58') throw new Error('Amount not updated');
    for (const method of ['Cerrar', 'Cerrar diálogo', 'Escape']) {
      await trigger.click();
      calculator = page.getByRole('dialog', { name: 'Calculadora', exact: true });
      await calculator.waitFor();
      if (method === 'Escape') await page.keyboard.press('Escape');
      else await calculator.getByRole('button', { name: method, exact: true }).click();
      if (await page.getByRole('dialog').count() !== 1) throw new Error('Wrong modal closed');
      if (!await trigger.evaluate(el => el === document.activeElement)) throw new Error('Focus not restored');
    }
    await trigger.click();
    calculator = page.getByRole('dialog', { name: 'Calculadora', exact: true });
    await calculator.waitFor();
    await page.keyboard.press('Shift+Tab');
    if (!await calculator.evaluate(el => el.contains(document.activeElement))) throw new Error('Focus escaped');
    await page.keyboard.press('Escape');
    if (await transaction.evaluate(el => el.scrollWidth > el.clientWidth)) throw new Error('Dialog overflow');
    results.push({ width, amount: 58, closeMethods: 3, focus: 'pass', icon: 'pass' });
  }
  return results;
}
