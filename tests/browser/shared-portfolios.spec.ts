import { expect, test } from '@playwright/test';

import { readIntegrationFixture } from './integration-fixture';

test.use({ storageState: { cookies: [], origins: [] } });

test('renders only allowlisted public portfolio metadata under CSP', async ({ page }) => {
  const { publicShareId } = readIntegrationFixture();
  const privateRequests: string[] = [];
  page.on('request', (request) => {
    if (
      request.url().includes('/api/portfolio') &&
      !request.url().includes('/api/portfolio/access')
    ) {
      privateRequests.push(request.url());
    }
  });

  const response = await page.goto(`/shared-portfolios/${publicShareId}`, {
    waitUntil: 'networkidle',
  });
  expect(response?.headers()['content-security-policy']).toBeTruthy();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Playwright public portfolio');
  await expect(page.getByText('Public fixture metadata only')).toBeVisible();
  await expect(page.getByText(/read only|tylko odczyt/i)).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  expect(privateRequests).toEqual([]);
});
