import { NextRequest } from 'next/server';

import { enqueueFinancialDataSync } from '@/lib/inngest';
import { recordAdminAuditEvent } from '@/lib/server/admin/audit';
import {
  AdminSyncPayloadSchema,
  assertAdminSessionAuthorization,
  createAdminSyncCommand,
} from '@/lib/server/admin/service';
import { apiHandler } from '@/lib/server/http/api-handler';
import { adminRateLimitPolicy } from '@/lib/server/http/rate-limiter';
import { readOptionalJsonBody } from '@/lib/server/http/read-json-body';
import { getRequestId } from '@/lib/server/http/request-context';
import { createUnauthorizedResponse, okJson } from '@/lib/server/http/responses';

export const POST = apiHandler(
  async (req: NextRequest) => {
    try {
      await assertAdminSessionAuthorization();
      const body = await readOptionalJsonBody(req, AdminSyncPayloadSchema, {});
      const command = createAdminSyncCommand(body);
      const requestId = getRequestId(req);
      const event = await enqueueFinancialDataSync({
        mode: command.mode,
        requestedBy: 'admin',
        requestId,
      });
      await recordAdminAuditEvent({ action: 'sync-requested', requestId, detail: command.mode });

      return okJson(
        {
          message: 'Sync queued successfully',
          mode: command.mode,
          requestId,
          eventIds: event.ids,
        },
        { status: 202 },
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED_ADMIN_SESSION') {
        return createUnauthorizedResponse();
      }

      await recordAdminAuditEvent({ action: 'sync-failed' });
      throw error;
    }
  },
  { rateLimitPolicy: adminRateLimitPolicy },
);
