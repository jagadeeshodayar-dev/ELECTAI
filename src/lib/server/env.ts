import 'server-only';

export function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function getCivicApiKey() {
  return process.env.GOOGLE_CIVIC_API_KEY || process.env.VITE_GOOGLE_CIVIC_API_KEY || '';
}
