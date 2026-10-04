import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { parseCspReport, shouldSampleCspReport } from '@/lib/security/csp-reporting';
import { apiHandler } from '@/lib/server/http/api-handler';
import { observabilityRateLimitPolicy } from '@/lib/server/http/rate-limiter';
import { readBoundedJsonBody } from '@/lib/server/http/read-json-body';
import { createServerLogger } from '@/lib/server/logging';

const logger = createServerLogger('CspReportApi');

/** Browser-only endpoint: sampled, redacted CSP diagnostics without persistence. */
export const POST = apiHandler(
  async (request: NextRequest) => {
    // Reporting API delivery uses a batched JSON media type; legacy CSP uses its own.
    const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (
      contentType !== 'application/csp-report' &&
      contentType !== 'application/json' &&
      contentType !== 'application/reports+json'
    ) {
      return NextResponse.json(
        {
          type: 'https://api.obligacje.pl/errors/unsupported-media-type',
          title: 'Unsupported Media Type',
          status: 415,
          detail:
            'CSP reports must use application/csp-report, application/reports+json, or application/json.',
          code: 'UNSUPPORTED_MEDIA_TYPE',
        },
        { status: 415 },
      );
    }

    const report = parseCspReport(
      await readBoundedJsonBody(request, z.unknown(), 32_768, { requireJsonContentType: false }),
    );
    if (report && shouldSampleCspReport(report)) {
      logger.warn('Sampled CSP violation', report);
    }

    return new NextResponse(null, { status: 204 });
  },
  { rateLimitPolicy: observabilityRateLimitPolicy },
);
