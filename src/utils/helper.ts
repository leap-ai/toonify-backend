import fs from 'fs';
import path from 'path';

export function getApplePrivateKey(): string {
  // First, check for production secret file path
  const prodPath = '/etc/secrets/APPLE_PRIVATE_KEY_FILE';

  if (fs.existsSync(prodPath)) {
    return fs.readFileSync(prodPath, 'utf8');
  }

  // If not running in prod, use local fallback (for dev)
  const localPath = path.resolve(process.cwd(), 'secrets/key.p8');

  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, 'utf8');
  }

  throw new Error('Apple private key file not found in either production or development path');
}