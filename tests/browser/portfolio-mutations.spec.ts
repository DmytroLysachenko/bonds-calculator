import { expect, test } from '@playwright/test';

test('persists a portfolio through the authenticated browser session', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { __cspViolations?: string[] }).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as typeof window & { __cspViolations?: string[] }).__cspViolations?.push(
        `${event.effectiveDirective}: ${event.blockedURI}`,
      );
    });
  });
  const documentResponse = await page.goto('/notebook', { waitUntil: 'networkidle' });
  expect(documentResponse?.headers()['content-security-policy']).toContain("script-src 'self'");

  const access = await page.evaluate(async () => {
    const response = await fetch('/api/portfolio/access');
    return { body: await response.json(), status: response.status };
  });
  expect(access.status).toBe(200);
  expect(access.body.data.authMode).toBe('authenticated');

  const created = await page.evaluate(async () => {
    const response = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Playwright integration portfolio' }),
    });
    return { body: await response.json(), status: response.status };
  });
  expect(created.status).toBe(200);
  expect(created.body.data).toMatchObject({ name: 'Playwright integration portfolio' });

  await page.reload({ waitUntil: 'networkidle' });
  const card = page.locator('article').filter({ hasText: 'Playwright integration portfolio' });
  await card.getByRole('button', { name: /open portfolio|otwórz portfel/i }).click();
  const addLot = page.getByRole('button', { name: /add new lot|dodaj nową partię/i });
  await addLot.click();
  const editor = page.getByRole('dialog', { name: /add new lot|dodaj nową partię/i });
  await expect(editor).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(editor.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(addLot).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as typeof window & { __cspViolations?: string[] }).__cspViolations ?? [],
    ),
  ).toEqual([]);

  const savedLot = await page.evaluate(async (portfolioId) => {
    const response = await fetch('/api/portfolio/lots/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolioId,
        bondType: 'COI',
        purchaseDate: '2026-01-01',
        amount: 2,
        isRebought: false,
      }),
    });
    return { body: await response.json(), status: response.status };
  }, created.body.data.id);
  expect(savedLot.status).toBe(200);
  expect(savedLot.body.data).toMatchObject({ portfolioId: created.body.data.id });
  expect(Number(savedLot.body.data.bondQuantity)).toBe(2);

  const updatedLot = await page.evaluate(
    async ({ lotId, portfolioId }) => {
      const response = await fetch(`/api/portfolio/lots/${lotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Edited through authenticated browser session' }),
      });
      const lotsResponse = await fetch(`/api/portfolio/lots?portfolioId=${portfolioId}`);
      return {
        body: await response.json(),
        lots: await lotsResponse.json(),
        lotsStatus: lotsResponse.status,
        status: response.status,
      };
    },
    { lotId: savedLot.body.data.id, portfolioId: created.body.data.id },
  );
  expect(updatedLot.status).toBe(200);
  expect(updatedLot.lotsStatus).toBe(200);
  expect(updatedLot.body.data).toMatchObject({
    notes: 'Edited through authenticated browser session',
  });
  expect(updatedLot.lots.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: savedLot.body.data.id,
        notes: 'Edited through authenticated browser session',
      }),
    ]),
  );

  const portfolios = await page.evaluate(async () => {
    const response = await fetch('/api/portfolio');
    return { body: await response.json(), status: response.status };
  });
  expect(portfolios.status).toBe(200);
  expect(portfolios.body.data).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: created.body.data.id })]),
  );

  const exported = await page.evaluate(async (portfolioId) => {
    const response = await fetch(`/api/portfolio/export?portfolioId=${portfolioId}&format=package`);
    return { body: await response.json(), status: response.status };
  }, created.body.data.id);
  expect(exported.status).toBe(200);
  expect(exported.body.data.portfolio.lots).toHaveLength(1);
  expect(exported.body.data.summary).not.toBeNull();

  const deleted = await page.evaluate(async (lotId) => {
    const response = await fetch(`/api/portfolio/lots/${lotId}`, { method: 'DELETE' });
    return { body: await response.json(), status: response.status };
  }, savedLot.body.data.id);
  expect(deleted.status).toBe(200);
  expect(deleted.body.data).toEqual({ success: true });

  const imported = await page.evaluate(async (portfolioPackage) => {
    const response = await fetch('/api/portfolio/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(portfolioPackage),
    });
    return { body: await response.json(), status: response.status };
  }, exported.body.data);
  expect(imported.status).toBe(200);
  expect(imported.body.data.importedLots).toBe(1);
  const restored = await page.evaluate(async (portfolioId) => {
    const response = await fetch(`/api/portfolio/lots?portfolioId=${portfolioId}`);
    return { body: await response.json(), status: response.status };
  }, imported.body.data.portfolio.id);
  expect(restored.status).toBe(200);
  expect(restored.body.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        bondType: 'COI',
        notes: 'Edited through authenticated browser session',
      }),
    ]),
  );
});
