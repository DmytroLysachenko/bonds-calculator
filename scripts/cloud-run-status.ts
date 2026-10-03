import { execFileSync, execSync } from 'node:child_process';

interface EnvVar {
  name?: string;
  value?: string;
}

interface TrafficTarget {
  percent?: number;
  revisionName?: string;
  latestRevision?: boolean;
}

interface CloudRunService {
  spec?: {
    template?: {
      spec?: {
        containers?: Array<{
          image?: string;
          env?: EnvVar[];
        }>;
      };
    };
    traffic?: TrafficTarget[];
  };
  status?: {
    address?: {
      url?: string;
    };
    latestCreatedRevisionName?: string;
    latestReadyRevisionName?: string;
    traffic?: TrafficTarget[];
    url?: string;
  };
}

const DEFAULT_PROJECT_ID = 'bond-calculator-pl';
const DEFAULT_REGION = 'europe-west1';
const DEFAULT_SERVICE = 'obligacje-calculator';

function runGcloud(args: string[]) {
  if (process.platform === 'win32') {
    return execSync(`gcloud ${args.join(' ')}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  return execFileSync('gcloud', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function parseArgs(argv: string[]) {
  const options = {
    project: process.env.GCP_PROJECT_ID ?? DEFAULT_PROJECT_ID,
    region: process.env.GCP_REGION ?? DEFAULT_REGION,
    service: process.env.CLOUD_RUN_SERVICE ?? DEFAULT_SERVICE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

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

  return options;
}

function formatTraffic(targets: TrafficTarget[] = []) {
  if (targets.length === 0) {
    return 'none';
  }

  return targets
    .map((target) => {
      const name = target.revisionName ?? (target.latestRevision ? 'latest' : 'unknown');
      return `${name}: ${target.percent ?? 0}%`;
    })
    .join(', ');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = runGcloud([
    'run',
    'services',
    'describe',
    options.service,
    '--project',
    options.project,
    '--region',
    options.region,
    '--format=json',
  ]);
  const service = JSON.parse(raw) as CloudRunService;
  const container = service.spec?.template?.spec?.containers?.[0];
  const env = container?.env ?? [];

  console.log(`Service: ${options.service}`);
  console.log(`Project: ${options.project}`);
  console.log(`Region: ${options.region}`);
  console.log(`URL: ${service.status?.url ?? service.status?.address?.url ?? 'unknown'}`);
  console.log(`Latest created revision: ${service.status?.latestCreatedRevisionName ?? 'unknown'}`);
  console.log(`Latest ready revision: ${service.status?.latestReadyRevisionName ?? 'unknown'}`);
  console.log(`Image: ${container?.image ?? 'unknown'}`);
  console.log(`Traffic: ${formatTraffic(service.status?.traffic ?? service.spec?.traffic)}`);
  console.log('Runtime env presence:');

  for (const item of env.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))) {
    console.log(`- ${item.name}: ${item.value ? 'set' : 'missing'}`);
  }
}

main();
