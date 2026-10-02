import { expect, test } from '@playwright/test';

import { readIntegrationFixture } from './integration-fixture';

test('uses a persisted Auth.js session for private portfolio reads', async ({ page }) => {
  const fixture = readIntegrationFixture();
  await page.goto('/notebook', { waitUntil: 'networkidle' });

  const access = await page.evaluate(async () => {
    const response = await fetch('/api/portfolio/access');
    return { body: await response.json(), status: response.status };
  });
  expect(access.status).toBe(200);
  expect(access.body.data).toMatchObject({
    ownerId: fixture.userId,
    authMode: 'authenticated',
    isGuest: false,
  });

  const portfolios = await page.evaluate(async () => {
    const response = await fetch('/api/portfolio');
    return { body: await response.json(), status: response.status };
  });
  expect(portfolios.status).toBe(200);
  expect(portfolios.body.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        shareId: fixture.publicShareId,
        userId: fixture.userId,
      }),
    ]),
  );
  expect(
    portfolios.body.data.every(
      (portfolio: { userId: string }) => portfolio.userId === fixture.userId,
    ),
  ).toBe(true);
});
