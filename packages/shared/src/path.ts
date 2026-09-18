import os from 'node:os';
import path from 'node:path';

export function formatPath(targetPath: string): string {
  const home = os.homedir();
  const normalizedTarget = path.resolve(targetPath);
  const normalizedHome = path.resolve(home);

  if (normalizedTarget === normalizedHome) {
    return '~';
  }

  if (normalizedTarget.startsWith(normalizedHome + path.sep)) {
    return `~${normalizedTarget.slice(normalizedHome.length)}`;
  }

  return normalizedTarget;
}
