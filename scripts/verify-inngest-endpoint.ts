import { pathToFileURL } from 'node:url';

type Fetcher = (url: string, init: RequestInit) => Promise<Pick<Response, 'status' | 'headers'>>;

/** An unsigned metadata request must be handled and rejected by the Inngest SDK. */
export async function verifyInngestEndpoint(baseUrl: string, fetcher: Fetcher = fetch) {
  const url = new URL('/api/inngest', baseUrl).toString();
  const response = await fetcher(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status !== 401 || response.headers.get('x-inngest-sdk-handled') !== 'true') {
    throw new Error(
      `Inngest endpoint did not reject an unsigned request through the SDK (HTTP ${response.status}).`,
    );
  }
}

async function main(argv = process.argv.slice(2)) {
  if (!argv[0]) {
    throw new Error('Pass the deployed app base URL.');
  }

  await verifyInngestEndpoint(argv[0]);
  console.log('Inngest endpoint is reachable and rejects unsigned requests.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
