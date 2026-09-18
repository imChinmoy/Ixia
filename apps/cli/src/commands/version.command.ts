import { DEFAULT_VERSION } from '@sora/core';

export function getVersion(): string {
  return DEFAULT_VERSION;
}

export function printVersion(): void {
  console.log(getVersion());
}
