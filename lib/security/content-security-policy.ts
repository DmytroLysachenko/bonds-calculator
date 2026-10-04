const baseDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
];

export type ContentSecurityPolicyDirectives = Record<string, string[]>;

/**
 * Parses the header shape browsers actually receive. Keeping this tiny parser
 * close to policy construction makes header-level regression tests possible
 * without duplicating fragile string matching in every test suite.
 */
export function parseContentSecurityPolicy(policy: string): ContentSecurityPolicyDirectives {
  return policy.split(';').reduce<ContentSecurityPolicyDirectives>((directives, segment) => {
    const [name, ...sources] = segment.trim().split(/\s+/);

    if (name) {
      directives[name] = sources;
    }

    return directives;
  }, {});
}

export function hasCspSource(
  policy: ContentSecurityPolicyDirectives,
  directive: string,
  source: string,
) {
  return policy[directive]?.includes(source) ?? false;
}

export function createContentSecurityPolicy(nonce: string, isDevelopment = false) {
  const scriptSource = isDevelopment
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}'`;

  // Next Fast Refresh and browser developer tools inject style elements without
  // access to the request nonce. A nonce source makes 'unsafe-inline' ineffective,
  // so the development style directives must omit it. Production stays nonce-only.
  const styleElementSource = isDevelopment
    ? "style-src 'self' 'unsafe-inline'"
    : `style-src 'self' 'nonce-${nonce}'`;
  const styleElementDirective = isDevelopment
    ? "style-src-elem 'self' 'unsafe-inline'"
    : `style-src-elem 'self' 'nonce-${nonce}'`;

  return [
    ...baseDirectives,
    scriptSource,
    styleElementSource,
    styleElementDirective,
    // Recharts, Radix and the route announcer set runtime dimensions/positioning
    // attributes. Their values are dynamic, so hashes cannot cover them. Keep
    // script eval forbidden and style elements nonce-protected; only style
    // attributes are relaxed for these presentation primitives.
    "style-src-attr 'unsafe-inline'",
    'report-to csp',
  ].join('; ');
}

/**
 * Runtime library positioning needs style attributes, while style elements
 * remain nonce protected and cannot be injected without a request nonce.
 */
export function supportsRuntimePresentationStyles(policy: string) {
  const directives = parseContentSecurityPolicy(policy);

  return (
    hasCspSource(directives, 'style-src-attr', "'unsafe-inline'") &&
    hasCspSource(directives, 'style-src-elem', "'self'") &&
    !hasCspSource(directives, 'style-src', "'unsafe-inline'")
  );
}

export const permissionsPolicy = [
  'accelerometer=()',
  'camera=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ');

/**
 * Keep browsing contexts and same-origin assets isolated without enabling
 * COEP, which would block the official data sources used by the application.
 */
export const crossOriginSecurityHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

export const cspReportingHeaders = {
  'Reporting-Endpoints': 'csp="/api/security/csp-report"',
  'Report-To': JSON.stringify({
    group: 'csp',
    max_age: 86_400,
    endpoints: [{ url: '/api/security/csp-report' }],
  }),
} as const;
