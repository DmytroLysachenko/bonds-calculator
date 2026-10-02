import { NextRequest } from 'next/server';

import { recordAdminAuditEvent } from '@/lib/server/admin/audit';
import {
  assertAdminSessionAuthorization,
  getAdminStatusSnapshot,
} from '@/lib/server/admin/service';
import { apiHandler } from '@/lib/server/http/api-handler';
import { adminRateLimitPolicy } from '@/lib/server/http/rate-limiter';
import { getRequestId } from '@/lib/server/http/request-context';
import { createUnauthorizedResponse, okJson } from '@/lib/server/http/responses';

export const GET = apiHandler(
  async (request: NextRequest) => {
    try {
      await assertAdminSessionAuthorization();
      const statusSnapshot = await getAdminStatusSnapshot();
      await recordAdminAuditEvent({ action: 'status-read', requestId: getRequestId(request) });

      return okJson(statusSnapshot);
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED_ADMIN_SESSION') {
        return createUnauthorizedResponse();
      }
      throw error;
    }
  },
  { rateLimitPolicy: adminRateLimitPolicy },
);
