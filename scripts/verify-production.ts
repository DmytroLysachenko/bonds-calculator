import { execFileSync, execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

interface VerifyOptions {
  baseUrl: string;
  identityToken?: string;
  allowMissingOauth: boolean;
  expectedImage?: string;
  expectedRevision?: string;
  project: string;
  region: string;
  service: string;
}

interface ReadinessResponse {
  ok: boolean;
  checks?: {
    env?: {
      status?: string;
      detail?: string;
    };
    database?: {
      status?: string;
      detail?: string;
    };
  };
}

interface FetchResult {
  status: number;
  ok: boolean;
  body: string;
  contentType: string;
}

interface CloudRunService {
  status?: {
    traffic?: Array<{
      percent?: number;
      revisionName?: string;
    }>;
  };
}

const DEFAULT_BASE_URL = 'https://obligacje-calculator-738965529859.europe-west1.run.app';
const DEFAULT_PROJECT_ID = 'bond-calculator-pl';
const DEFAULT_REGION = 'europe-west1';
const DEFAULT_SERVICE = 'obligacje-calculator';
const BODY_SNIPPET_LENGTH = 240;

export const ADMITTED_PREVIEW_SMOKE_CHECKS: Array<{
  path: string;
  label: string;
  kind: 'html' | 'json';
}> = [
  { path: '/api/health', label: 'health', kind: 'json' },
  { path: '/education', label: 'education', kind: 'html' },
  { path: '/single-calculator', label: 'single calculator', kind: 'html' },
  { path: '/economic-data', label: 'economic data', kind: 'html' },
  { path: '/api/calculation-defaults', label: 'calculation defaults', kind: 'json' },
  { path: '/login', label: 'login', kind: 'html' },
];

export function parseArgs(argv: string[]): VerifyOptions {
  const options: VerifyOptions = {
    baseUrl: process.env.PROD_BASE_URL ?? DEFAULT_BASE_URL,
    identityToken: process.env.IDENTITY_TOKEN,
    allowMissingOauth: process.env.ALLOW_MISSING_OAUTH === 'true',
    expectedImage: process.env.EXPECTED_IMAGE,
    expectedRevision: process.env.EXPECTED_REVISION,
    project: process.env.GCP_PROJECT_ID ?? DEFAULT_PROJECT_ID,
    region: process.env.GCP_REGION ?? DEFAULT_REGION,
    service: process.env.CLOUD_RUN_SERVICE ?? DEFAULT_SERVICE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--base-url' && next) {
      options.baseUrl = next;
      index += 1;
      continue;
    }

    if (arg === '--identity-token' && next) {
      options.identityToken = next;
      index += 1;
      continue;
    }

    if (arg === '--allow-missing-oauth') {
      options.allowMissingOauth = true;
      continue;
    }

    if (arg === '--expected-image' && next) {
      options.expectedImage = next;
      index += 1;
      continue;
    }

    if (arg === '--expected-revision' && next) {
      options.expectedRevision = next;
      index += 1;
      continue;
    }

    if (arg === '--project' && next) {
      options.project = next;
      index += 1;
      continue;
    }

    if (arg === '--region' && next) {
      options.region = next;
      index += 1;
      continue;
    }

    if (arg === '--service' && next) {
      options.service = next;
      index += 1;
    }
  }

  return {
    ...options,
    baseUrl: options.baseUrl.replace(/\/$/, ''),
  };
}

function getIdentityToken() {
  try {
    if (process.platform === 'win32') {
      return execSync('gcloud auth print-identity-token', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    }

    return execFileSync('gcloud', ['auth', 'print-identity-token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return undefined;
  }
}

function runGcloud(args: string[]) {
  if (process.platform === 'win32') {
    return execSync(`gcloud ${args.join(' ')}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }

  return execFileSync('gcloud', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function verifyExpectedImage(options: VerifyOptions) {
  if (!options.expectedImage) {
    return;
  }

  const deployedImage = runGcloud([
    'run',
    'services',
    'describe',
    options.service,
    '--project',
    options.project,
    '--region',
    options.region,
    '--format=value(spec.template.spec.containers[0].image)',
  ]);

  assertOk(
    deployedImage === options.expectedImage,
    `Cloud Run image mismatch: expected ${options.expectedImage}, found ${deployedImage}`,
  );

  console.log(`Cloud Run image ok: ${deployedImage}`);
}

function verifyExpectedRevision(options: VerifyOptions) {
  if (!options.expectedRevision) {
    return;
  }

  const service = JSON.parse(
    runGcloud([
      'run',
      'services',
      'describe',
      options.service,
      '--project',
      options.project,
      '--region',
      options.region,
      '--format=json',
    ]),
  ) as CloudRunService;

  const activeTraffic = service.status?.traffic?.find((target) => target.percent === 100);

  assertOk(
    activeTraffic?.revisionName === options.expectedRevision,
    `Cloud Run revision mismatch: expected ${options.expectedRevision} at 100% traffic, found ${activeTraffic?.revisionName ?? 'none'}`,
  );

  console.log(`Cloud Run revision ok: ${options.expectedRevision}`);
}

async function fetchPath(options: VerifyOptions, path: string): Promise<FetchResult> {
  const response = await fetch(`${options.baseUrl}${path}`, {
    headers: options.identityToken
      ? {
          Authorization: `Bearer ${options.identityToken}`,
        }
      : undefined,
  });
  const body = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    body,
    contentType: response.headers.get('content-type') ?? '',
  };
}

function createResponseSummary(label: string, path: string, response: FetchResult) {
  const snippet = response.body.replace(/\s+/g, ' ').slice(0, BODY_SNIPPET_LENGTH);

  return `${label} failed at ${path}: status=${response.status} contentType=${response.contentType} body="${snippet}"`;
}

function assertOk(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseJson<T>(label: string, path: string, response: FetchResult): T {
  try {
    return JSON.parse(response.body) as T;
  } catch {
    throw new Error(createResponseSummary(`${label} JSON parse`, path, response));
  }
}

function verifyHtmlResponse(label: string, path: string, response: FetchResult) {
  assertOk(response.ok, createResponseSummary(label, path, response));
  assertOk(
    response.contentType.includes('text/html'),
    `${label} returned non-HTML contentType=${response.contentType}`,
  );
  assertOk(
    response.body.includes('<!DOCTYPE html>') || response.body.includes('__next'),
    `${label} returned HTML without the expected Next.js document markers`,
  );
  console.log(`${label} ok`);
}

export function shouldRequireLoginProviderForm({
  allowMissingOauth,
}: Pick<VerifyOptions, 'allowMissingOauth'>) {
  return !allowMissingOauth;
}

function verifyLoginResponse(response: FetchResult, options: VerifyOptions) {
  verifyHtmlResponse('login', '/login', response);
  if (shouldRequireLoginProviderForm(options)) {
    assertOk(response.body.includes('<form'), 'login did not render a provider sign-in form');
  }
  assertOk(
    !/AUTH_GOOGLE_(?:ID|SECRET)|AUTH_FACEBOOK_(?:ID|SECRET)/.test(response.body),
    'login response exposed OAuth credential configuration',
  );
  console.log(
    options.allowMissingOauth
      ? 'login accessible: OAuth provider intentionally missing for private preview'
      : 'login OAuth readiness ok',
  );
}

function verifyJsonResponse(label: string, path: string, response: FetchResult) {
  assertOk(response.ok, createResponseSummary(label, path, response));
  assertOk(
    response.contentType.includes('application/json'),
    `${label} returned non-JSON contentType=${response.contentType}`,
  );
  parseJson<unknown>(label, path, response);
  console.log(`${label} ok`);
}

async function verifyReadiness(options: VerifyOptions) {
  const path = '/api/readiness';
  const readiness = await fetchPath(options, path);
  const payload = parseJson<ReadinessResponse>('readiness', path, readiness);

  assertOk(
    !/AUTH_GOOGLE_(?:ID|SECRET)|AUTH_FACEBOOK_(?:ID|SECRET)/.test(readiness.body),
    'readiness response exposed OAuth credential configuration',
  );

  if (readiness.ok && payload.ok) {
    console.log('readiness ok');
    return;
  }

  const databaseStatus = payload.checks?.database?.status;
  const envDetail = payload.checks?.env?.detail ?? '';
  const onlyOauthMissing =
    options.allowMissingOauth &&
    databaseStatus === 'ok' &&
    envDetail === 'Missing required runtime configuration: OAUTH_PROVIDER';

  assertOk(
    onlyOauthMissing,
    createResponseSummary('readiness failed unexpectedly', path, readiness),
  );

  console.log('readiness degraded: OAuth provider intentionally missing; database ok');
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  options.identityToken ??= getIdentityToken();

  assertOk(Boolean(options.identityToken), 'Missing identity token. Run gcloud auth login first.');

  for (const check of ADMITTED_PREVIEW_SMOKE_CHECKS) {
    const response = await fetchPath(options, check.path);
    assertOk(response.body.length > 0, `${check.label} returned an empty body`);

    if (check.path === '/login') {
      verifyLoginResponse(response, options);
    } else if (check.kind === 'html') {
      verifyHtmlResponse(check.label, check.path, response);
    } else {
      verifyJsonResponse(check.label, check.path, response);
    }
  }

  await verifyReadiness(options);
  verifyExpectedImage(options);
  verifyExpectedRevision(options);
  console.log(`Production verification passed for ${options.baseUrl}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
