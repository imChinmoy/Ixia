import path from 'node:path';

const SENSITIVE_EXACT_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.test',
  '.env.staging',
  'id_rsa',
  'id_ed25519',
  'id_dsa',
]);

const SENSITIVE_EXTENSIONS = new Set([
  '.pem',
  '.key',
  '.pkcs12',
  '.pfx',
  '.p12',
  '.keystore',
  '.jks',
]);

const SAFE_ENV_PATTERNS = new Set([
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.dist',
  '.env.default',
]);

/**
 * Checks whether a given relative or absolute file path points to a sensitive or secret-bearing file.
 * The contents of sensitive files must NEVER be read into LLM context.
 */
export function isSensitiveFile(filePath: string): boolean {
  const filename = path.basename(filePath).toLowerCase();

  // Explicitly safe templates
  if (SAFE_ENV_PATTERNS.has(filename)) {
    return false;
  }

  // Exact names
  if (SENSITIVE_EXACT_NAMES.has(filename)) {
    return true;
  }

  // Any other .env.* file (e.g. .env.secret, .env.auth)
  if (filename.startsWith('.env.')) {
    return true;
  }

  // Sensitive extension (e.g. server.key, cert.pem)
  const ext = path.extname(filename);
  if (SENSITIVE_EXTENSIONS.has(ext)) {
    return true;
  }

  // Secret file prefix / wildcard
  if (
    filename.startsWith('credentials.') ||
    filename.startsWith('secrets.') ||
    filename.startsWith('secret.') ||
    filename.startsWith('service-account') ||
    filename.startsWith('id_rsa') ||
    filename.startsWith('id_ed25519')
  ) {
    return true;
  }

  return false;
}
