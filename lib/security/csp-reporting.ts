import { z } from 'zod';

const MAX_DIRECTIVE_LENGTH = 120;
const MAX_URI_LENGTH = 512;

const CspReportSchema = z
  .object({
    'blocked-uri': z.string().max(MAX_URI_LENGTH).optional(),
    'column-number': z.number().int().nonnegative().optional(),
    'document-uri': z.string().max(MAX_URI_LENGTH).optional(),
    'effective-directive': z.string().max(MAX_DIRECTIVE_LENGTH).optional(),
    'line-number': z.number().int().nonnegative().optional(),
    'original-policy': z.string().max(4096).optional(),
    referrer: z.string().max(MAX_URI_LENGTH).optional(),
    'source-file': z.string().max(MAX_URI_LENGTH).optional(),
    'status-code': z.number().int().min(100).max(599).optional(),
    'violated-directive': z.string().max(MAX_DIRECTIVE_LENGTH).optional(),
  })
  .strict();

const CspReportEnvelopeSchema = z
  .object({
    'csp-report': CspReportSchema,
  })
  .strict();

const ModernCspReportBodySchema = z.object({
  blockedURL: z.string().max(MAX_URI_LENGTH).optional(),
  blocked_url: z.string().max(MAX_URI_LENGTH).optional(),
  documentURL: z.string().max(MAX_URI_LENGTH).optional(),
  document_url: z.string().max(MAX_URI_LENGTH).optional(),
  effectiveDirective: z.string().max(MAX_DIRECTIVE_LENGTH).optional(),
  effective_directive: z.string().max(MAX_DIRECTIVE_LENGTH).optional(),
  sourceFile: z.string().max(MAX_URI_LENGTH).optional(),
  source_file: z.string().max(MAX_URI_LENGTH).optional(),
});

const ModernCspReportSchema = z.object({
  type: z.literal('csp-violation'),
  url: z.string().max(MAX_URI_LENGTH).optional(),
  body: ModernCspReportBodySchema,
});

export type SanitizedCspReport = {
  blockedOrigin: string | null;
  directive: string | null;
  documentPath: string | null;
  sourcePath: string | null;
};

function sanitizeUrl(value: string | undefined, includeOrigin: boolean) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return includeOrigin ? url.origin : url.pathname;
  } catch {
    return value === 'inline' || value === 'eval' || value === 'data' ? value : null;
  }
}

function sanitizeDirective(value: string | undefined) {
  if (!value) return null;
  return value.split(/\s+/)[0]?.slice(0, MAX_DIRECTIVE_LENGTH) ?? null;
}

/**
 * Parses legacy envelopes or a bounded Reporting API batch and strips query
 * strings, fragments, policy text, referrers, and line details before logging.
 */
export function parseCspReport(payload: unknown): SanitizedCspReport | null {
  if (Array.isArray(payload)) {
    if (payload.length > 64) return null;
    for (const item of payload) {
      const modern = ModernCspReportSchema.safeParse(item);
      if (!modern.success) continue;
      const { body } = modern.data;
      return {
        blockedOrigin: sanitizeUrl(body.blockedURL ?? body.blocked_url, true),
        directive: sanitizeDirective(body.effectiveDirective ?? body.effective_directive),
        documentPath: sanitizeUrl(body.documentURL ?? body.document_url ?? modern.data.url, false),
        sourcePath: sanitizeUrl(body.sourceFile ?? body.source_file, false),
      };
    }
    return null;
  }

  const parsed = CspReportEnvelopeSchema.safeParse(payload);
  if (!parsed.success) return null;

  const report = parsed.data['csp-report'];
  return {
    blockedOrigin: sanitizeUrl(report['blocked-uri'], true),
    directive: sanitizeDirective(report['effective-directive'] ?? report['violated-directive']),
    documentPath: sanitizeUrl(report['document-uri'], false),
    sourcePath: sanitizeUrl(report['source-file'], false),
  };
}

export function shouldSampleCspReport(
  report: SanitizedCspReport,
  sampleRate = 0.1,
  random = Math.random,
) {
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;

  // Always retain an unfamiliar directive; otherwise sample repetitive noise.
  if (!report.directive) return true;
  return random() < sampleRate;
}
