import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must name an isolated disposable database.');
}

const env = {
  ...process.env,
  AUTH_SECRET: process.env.AUTH_SECRET ?? 'playwright-integration-auth-secret-not-for-production',
  AUTH_TRUST_HOST: 'true',
  DATABASE_TRANSACTION_URL: process.env.TEST_DATABASE_URL,
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  PLAYWRIGHT_INTEGRATION_DATABASE: 'postgres-js',
  NEXT_PUBLIC_PLAYWRIGHT_SMOKE: '0',
  PLAYWRIGHT_SMOKE: '0',
  PORT: process.env.PORT ?? '3200',
};

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Integration server command failed with exit code ${code ?? 'unknown'}.`));
    });
  });
}

await run([require.resolve('next/dist/bin/next'), 'build', '--webpack']);

const server = spawn(process.execPath, ['scripts/start-playwright-server.mjs'], {
  env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}

server.on('exit', (code) => process.exit(code ?? 0));
