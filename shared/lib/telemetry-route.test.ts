import { expect, it } from 'vitest';

import { telemetryRoute } from './telemetry-route';

it.each([
  ['/single-calculator?email=private@example.test', '/single-calculator'],
  ['/shared-portfolios/private-id#fragment', '/shared-portfolios'],
  ['/shared-scenarios/private-id', '/shared-scenarios'],
  ['/users/private-name', '/other'],
])('does not retain private path data: %s', (path, expected) => {
  expect(telemetryRoute(path)).toBe(expected);
});
