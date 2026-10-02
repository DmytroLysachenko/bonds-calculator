const DEFAULT_PRODUCTION_URL = 'https://obligacje-calculator-ji72nqwtea-lm.a.run.app';
const DEFAULT_DEVELOPMENT_URL = 'http://localhost:3000';

export type DeploymentTier = 'preview' | 'production';

function getDeploymentTier(env: NodeJS.ProcessEnv = process.env): DeploymentTier {
  return env.NEXT_PUBLIC_DEPLOYMENT_TIER === 'production' ? 'production' : 'preview';
}

export function isIndexableDeployment(env: NodeJS.ProcessEnv = process.env) {
  return getDeploymentTier(env) === 'production';
}

export function getCanonicalBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const configuredUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  const fallbackUrl =
    env.NODE_ENV === 'production' ? DEFAULT_PRODUCTION_URL : DEFAULT_DEVELOPMENT_URL;

  try {
    const parsed = new URL(configuredUrl || fallbackUrl);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('Invalid canonical URL');
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return fallbackUrl;
  }
}

export function getCanonicalUrl(path = '', env: NodeJS.ProcessEnv = process.env) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${getCanonicalBaseUrl(env)}${normalizedPath === '/' ? '' : normalizedPath}`;
}
