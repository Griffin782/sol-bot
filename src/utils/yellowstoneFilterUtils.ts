import bs58 from "bs58";

export function assertValidPubkey(key: string, label: string): string {
  let decoded: Uint8Array;

  try {
    decoded = bs58.decode(key.trim());
  } catch (e) {
    throw new Error(
      `[YELLOWSTONE-FILTER] ${label} is not valid base58: "${key}".\n` +
      `Original error: ${(e as Error).message}`
    );
  }

  if (decoded.length !== 32) {
    throw new Error(
      `[YELLOWSTONE-FILTER] ${label} decoded length = ${decoded.length}, expected 32 bytes.\n` +
      `Key: "${key}"`
    );
  }

  return key.trim(); // safe
}

export function validatePubkeys(keys: string[], labelPrefix: string): string[] {
  return keys.map((k, i) => assertValidPubkey(k, `${labelPrefix}[${i}]`));
}
